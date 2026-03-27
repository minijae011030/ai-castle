package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentPlanningToolDtos.*;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ApplyMode;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleApplyRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ReschedulePlanItem;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ReschedulePlanResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleSimulateRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleValidateRequest;
import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.dto.ChatDtos.NegotiationTodoRequestItem;
import com.aicastle.backend.dto.ChatDtos.TodoItem;
import com.aicastle.backend.dto.ChatDtos.TodoPriority;
import com.aicastle.backend.dto.ChatDtos.TodoStatus;
import com.aicastle.backend.openai.OpenAiChatDtos.Message;
import com.aicastle.backend.openai.OpenAiClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AgentChatPlanningSupport {
  private static final Logger log = LoggerFactory.getLogger(AgentChatPlanningSupport.class);
  private static final ZoneId PLANNER_ZONE_ID = ZoneId.of("Asia/Seoul");
  private static final Pattern DATE_RANGE_PATTERN =
      Pattern.compile(
          "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2})\\s*[~\\-]\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2})");
  private static final Pattern SINGLE_DATE_PATTERN =
      Pattern.compile("(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2})");
  private static final Pattern DAY_ONLY_PATTERN = Pattern.compile("(\\d{1,2})일");
  private static final long EXAM_INFERENCE_CACHE_TTL_MS = 15_000L;
  private static final long TODO_SUMMARY_CACHE_TTL_MS = 30_000L;

  private final AgentPlanningToolService agentPlanningToolService;
  private final OpenAiClient openAiClient;
  private final ObjectMapper objectMapper;
  private final ConcurrentHashMap<String, CachedExamInference> examInferenceCache =
      new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, CachedTodoPlanningSummary> todoPlanningSummaryCache =
      new ConcurrentHashMap<>();

  public AgentChatPlanningSupport(
      AgentPlanningToolService agentPlanningToolService,
      OpenAiClient openAiClient,
      ObjectMapper objectMapper) {
    this.agentPlanningToolService = agentPlanningToolService;
    this.openAiClient = openAiClient;
    this.objectMapper = objectMapper;
  }

  public String buildNegotiationContext(
      String userMessage,
      List<NegotiationTodoRequestItem> negotiationTodos,
      String preferredDeadlineDate) {
    StringBuilder sb = new StringBuilder();
    sb.append(userMessage == null || userMessage.isBlank() ? "선택한 TODO 일정을 조정해주세요." : userMessage);
    sb.append("\n\n[조정 요청 컨텍스트]");
    if (preferredDeadlineDate != null && !preferredDeadlineDate.isBlank()) {
      sb.append("\n- 희망 완료 기한: ").append(preferredDeadlineDate);
    }
    if (negotiationTodos == null || negotiationTodos.isEmpty()) {
      sb.append("\n- 선택된 TODO 없음");
      return sb.toString();
    }

    sb.append("\n- 선택된 TODO 목록:");
    int index = 1;
    for (NegotiationTodoRequestItem todo : negotiationTodos) {
      if (todo == null) continue;
      sb.append("\n  ")
          .append(index++)
          .append(". #")
          .append(todo.scheduleId() == null ? "-" : todo.scheduleId())
          .append(" ")
          .append(todo.title() == null ? "" : todo.title())
          .append(" (")
          .append(todo.occurrenceDate() == null ? "" : todo.occurrenceDate())
          .append(" ")
          .append(todo.startAt() == null ? "" : todo.startAt())
          .append("~")
          .append(todo.endAt() == null ? "" : todo.endAt())
          .append(")");
    }
    return sb.toString();
  }

  public String runNegotiationToolLoop(
      Long userId,
      String userMessage,
      List<NegotiationTodoRequestItem> negotiationTodos,
      String preferredDeadlineDate) {
    return runNegotiationToolLoop(
        userId, userMessage, negotiationTodos, preferredDeadlineDate, null);
  }

  public String runNegotiationToolLoop(
      Long userId,
      String userMessage,
      List<NegotiationTodoRequestItem> negotiationTodos,
      String preferredDeadlineDate,
      Consumer<String> progressEmitter) {
    emitProgress(progressEmitter, "요청한 날짜 범위를 확인하고 있어요.");
    LocalDate[] range = resolveDateRange(userMessage, negotiationTodos);
    LocalDate startDate = range[0];
    LocalDate endDate = range[1];

    emitProgress(progressEmitter, "고정 일정과 기존 TODO를 조회하고 있어요.");
    agentPlanningToolService.getCalendarEvents(userId, startDate, endDate);
    List<Long> targetTodoIds = new ArrayList<>();
    if (negotiationTodos != null) {
      for (NegotiationTodoRequestItem item : negotiationTodos) {
        if (item == null || item.scheduleId() == null) continue;
        targetTodoIds.add(item.scheduleId());
      }
    }
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todosInRange =
        agentPlanningToolService.getTodos(userId, startDate, endDate, false);
    Integer requestedShiftMinutes = null;
    if (targetTodoIds.isEmpty()) {
      emitProgress(progressEmitter, "조정 대상 TODO와 이동 시간을 추론하고 있어요.");
      NegotiationIntentPlan intentPlan =
          planNegotiationIntent(userMessage, todosInRange, startDate);
      requestedShiftMinutes = intentPlan.shiftMinutes();
      targetTodoIds = intentPlan.targetTodoIds();
      log.info("❤️ [에이전트 조정] 조정 대상 추론 결과 targetTodoIds={}", targetTodoIds);
    }
    if (targetTodoIds.isEmpty()) {
      Map<String, Object> payload =
          Map.of(
              "text",
              "조정할 TODO를 특정하지 못했어요. 제목(예: 기출문제 오답 암기)이나 날짜를 조금 더 구체적으로 알려주세요.",
              "groupTitle",
              "조정 대상 확인 필요",
              "todo",
              List.of());
      try {
        return objectMapper.writeValueAsString(payload);
      } catch (Exception e) {
        throw new IllegalStateException("조정 대상 안내 메시지 직렬화에 실패했습니다.");
      }
    }

    Integer maxShiftDays = 7;
    if (preferredDeadlineDate != null && !preferredDeadlineDate.isBlank()) {
      LocalDate preferredDate =
          tryParseDate(preferredDeadlineDate.trim(), LocalDate.now(PLANNER_ZONE_ID).getYear());
      if (preferredDate != null && !preferredDate.isBefore(endDate)) {
        maxShiftDays =
            Math.max(1, (int) java.time.temporal.ChronoUnit.DAYS.between(endDate, preferredDate));
      }
    }
    if (requestedShiftMinutes != null && requestedShiftMinutes > 0) {
      int shiftDays = Math.max(1, (requestedShiftMinutes + 1439) / 1440);
      maxShiftDays = Math.min(maxShiftDays, shiftDays);
    }

    ReschedulePlanResponse simulated =
        agentPlanningToolService.simulateReschedule(
            userId,
            new RescheduleSimulateRequest(startDate, endDate, targetTodoIds, maxShiftDays, 10));

    emitProgress(progressEmitter, "재배치 초안을 검증하고 있어요.");
    ReschedulePlanResponse validated =
        agentPlanningToolService.validatePlan(
            new RescheduleValidateRequest(simulated.items()).items(), userId);

    emitProgress(progressEmitter, "조정 초안을 저장하고 설명을 생성하고 있어요.");
    agentPlanningToolService.applyPlan(
        userId, new RescheduleApplyRequest(ApplyMode.DRAFT, validated.items()));

    String explainText =
        agentPlanningToolService.explainPlan(
            new com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleExplainRequest(
                userMessage, validated.items(), validated.conflicts()));

    List<TodoItem> todoItems = new ArrayList<>();
    for (ReschedulePlanItem item : validated.items()) {
      LocalDateTime startAt = item.proposedStartAt();
      LocalDateTime endAt = item.proposedEndAt();
      if (startAt == null || endAt == null) continue;
      todoItems.add(
          new TodoItem(
              item.title(),
              item.reason(),
              null,
              item.todoId() == null ? null : item.todoId().intValue(),
              TodoPriority.MEDIUM,
              TodoStatus.TODO,
              startAt.toLocalDate().toString(),
              startAt.toString(),
              endAt.toString()));
    }

    String groupTitle =
        resolveNegotiationGroupTitle(todosInRange, targetTodoIds, startDate, endDate);

    Map<String, Object> payload =
        Map.of(
            "text", explainText,
            "groupTitle", groupTitle,
            "todo", todoItems);
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (Exception e) {
      throw new IllegalStateException("재조정 결과 직렬화에 실패했습니다.");
    }
  }

  public String runTodoToolLoop(
      Long userId, Long agentId, String userMessage, String systemPrompt) {
    return runTodoToolLoop(userId, agentId, userMessage, systemPrompt, null);
  }

  public String runTodoToolLoop(
      Long userId,
      Long agentId,
      String userMessage,
      String systemPrompt,
      Consumer<String> progressEmitter) {
    emitProgress(progressEmitter, "요청에서 날짜 범위를 확인하고 있어요.");
    LocalDate[] range = resolveDateRange(userMessage, List.of());
    LocalDate startDate = range[0];
    LocalDate endDate = range[1];
    LocalDate[] lookupRange = resolveTodoLookupRange(userId, userMessage, startDate, endDate);
    LocalDate contextStartDate = lookupRange[0];
    LocalDate contextEndDate = lookupRange[1];

    emitProgress(progressEmitter, "고정 일정과 기존 TODO를 조회하고 있어요.");
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem> calendarEvents =
        agentPlanningToolService.getCalendarEvents(userId, contextStartDate, contextEndDate);
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> existingTodos =
        agentPlanningToolService.getTodos(userId, contextStartDate, contextEndDate, false);
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> agentTodos =
        agentPlanningToolService.getTodosByAgent(
            userId, agentId, contextStartDate, contextEndDate, false);
    com.aicastle.backend.dto.AgentPlanningToolDtos.UserConstraintResponse constraints =
        agentPlanningToolService.getUserConstraints(userId);

    try {
      boolean skipEnhancementPlanning =
          shouldSkipTodoEnhancementPlanning(
              userMessage, calendarEvents.size(), existingTodos.size(), agentTodos.size());
      if (skipEnhancementPlanning) {
        emitProgress(progressEmitter, "요청이 단순해 플래닝 단계를 축약하고 있어요.");
      } else {
        emitProgress(progressEmitter, "강화 커맨드를 계획하고 실행하고 있어요.");
      }
      List<String> plannedCommands =
          skipEnhancementPlanning
              ? List.of()
              : planTodoEnhancementCommands(
                  userMessage,
                  calendarEvents.size(),
                  existingTodos.size(),
                  agentTodos.size(),
                  contextStartDate,
                  contextEndDate);
      int commandLimit =
          resolveEnhancementCommandLimit(
              userMessage, calendarEvents.size(), existingTodos.size(), agentTodos.size());
      List<String> normalizedPlannedCommands =
          sanitizePlannedCommands(plannedCommands, commandLimit);
      log.info(
          "❤️ [에이전트 TODO] 강화 커맨드 최적화 skip={}, commandLimit={}, rawCommands={}, normalizedCommands={}",
          skipEnhancementPlanning,
          commandLimit,
          plannedCommands,
          normalizedPlannedCommands);
      Map<String, Object> enhancementResults =
          skipEnhancementPlanning
              ? Map.of("skipped", true, "reason", "simple_request")
              : executeTodoEnhancementCommands(
                  userId,
                  userMessage,
                  normalizedPlannedCommands,
                  contextStartDate,
                  contextEndDate,
                  existingTodos,
                  agentTodos);

      String toolContextJson =
          objectMapper.writeValueAsString(
              Map.of(
                  "range",
                  Map.of("startDate", startDate.toString(), "endDate", endDate.toString()),
                  "contextRange",
                  Map.of(
                      "startDate",
                      contextStartDate.toString(),
                      "endDate",
                      contextEndDate.toString()),
                  "calendarEvents",
                  calendarEvents,
                  "existingTodos",
                  existingTodos,
                  "agentTodos",
                  agentTodos,
                  "userConstraints",
                  constraints,
                  "plannedCommands",
                  normalizedPlannedCommands,
                  "skipEnhancementPlanning",
                  skipEnhancementPlanning,
                  "enhancementResults",
                  enhancementResults));
      String timeInterpretationHint =
          buildTimeInterpretationHint(
              userMessage, calendarEvents, contextStartDate, contextEndDate);

      cacheTodoPlanningSummary(
          userId,
          agentId,
          userMessage,
          contextStartDate,
          contextEndDate,
          calendarEvents.size(),
          existingTodos.size(),
          agentTodos.size(),
          normalizedPlannedCommands,
          skipEnhancementPlanning);

      List<Message> messages = new ArrayList<>();
      messages.add(new Message("system", systemPrompt));
      messages.add(
          new Message(
              "system",
              "[툴 실행 결과]\n"
                  + toolContextJson
                  + "\n\n"
                  + "- 기존 calendarEvents 와 existingTodos 와 충돌하지 않도록 todo를 제안하라.\n"
                  + "- 특히 agentTodos(해당 에이전트가 담당한 기존 TODO)의 연속성/우선순위를 우선 반영하라.\n"
                  + "- userConstraints(dayStartTime/dayEndTime)를 반드시 지켜 시간대를 배치하라.\n"
                  + "- 기존 일정이 빡빡하면 estimateMinutes를 줄이거나 개수를 줄여 현실적으로 제안하라.\n"
                  + timeInterpretationHint));
      messages.add(new Message("user", userMessage));

      emitProgress(progressEmitter, "우선순위와 시간 충돌을 정리해서 추천안을 만들고 있어요.");
      String rawTodoResponse = openAiClient.createTodoJsonWithMessages(messages);
      return postProcessTodoNarrativeByEventContext(rawTodoResponse, userMessage, calendarEvents);
    } catch (Exception e) {
      throw new IllegalStateException("TODO 툴 루프 실행에 실패했습니다. " + e.getMessage());
    }
  }

  private String postProcessTodoNarrativeByEventContext(
      String rawTodoResponse,
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem> calendarEvents) {
    if (rawTodoResponse == null || rawTodoResponse.isBlank()) return rawTodoResponse;
    if (calendarEvents == null || calendarEvents.isEmpty()) return rawTodoResponse;
    try {
      JsonNode root = objectMapper.readTree(rawTodoResponse);
      JsonNode textNode = root.path("text");
      JsonNode todoNode = root.path("todo");
      if (!textNode.isTextual() || !todoNode.isArray() || todoNode.isEmpty())
        return rawTodoResponse;

      JsonNode firstTodo = todoNode.get(0);
      String todoStartAtRaw = firstTodo.path("startAt").asText("");
      if (todoStartAtRaw.isBlank()) return rawTodoResponse;
      LocalDateTime todoStartAt = LocalDateTime.parse(todoStartAtRaw);

      com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem matchedEvent =
          findBestMatchedEvent(userMessage, firstTodo, todoStartAt, calendarEvents);
      if (matchedEvent == null || matchedEvent.startAt() == null || matchedEvent.endAt() == null) {
        return rawTodoResponse;
      }
      LocalDateTime normalizedTodoStartAt =
          normalizeTodoTimeByEventContext(firstTodo, matchedEvent, userMessage);

      String originalText = textNode.asText("");
      if (originalText.isBlank()) return rawTodoResponse;
      String normalizedLabel = buildEventLabel(matchedEvent);
      RelationToEvent relation =
          determineRelationToEvent(
              normalizedTodoStartAt, matchedEvent.startAt(), matchedEvent.endAt());
      String rewrittenText =
          rewriteNarrativeByRelation(
              originalText,
              normalizedLabel,
              relation,
              matchedEvent.startAt(),
              matchedEvent.endAt());
      String alignedText =
          alignNarrativeHourExpression(
              rewrittenText, userMessage, normalizedTodoStartAt.toLocalTime().getHour(), relation);
      boolean todoFieldsChanged = rewriteTodoFieldsByRelation(todoNode, normalizedLabel, relation);
      boolean timeAdjusted = !normalizedTodoStartAt.equals(todoStartAt);
      if (alignedText.equals(originalText) && !todoFieldsChanged && !timeAdjusted)
        return rawTodoResponse;

      ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("text", alignedText);
      return objectMapper.writeValueAsString(root);
    } catch (Exception ignored) {
      return rawTodoResponse;
    }
  }

  private String alignNarrativeHourExpression(
      String text, String userMessage, int actualStartHour, RelationToEvent relation) {
    if (text == null || text.isBlank()) return text;
    if (userMessage == null || userMessage.isBlank()) return text;
    Matcher userHourMatcher = Pattern.compile("(\\d{1,2})\\s*시").matcher(userMessage.toLowerCase());
    if (!userHourMatcher.find()) return text;
    int mentionedHour;
    try {
      mentionedHour = Integer.parseInt(userHourMatcher.group(1));
    } catch (Exception ignored) {
      return text;
    }
    if (mentionedHour < 1 || mentionedHour > 12) return text;
    int normalizedActualHour = actualStartHour;
    if (relation == RelationToEvent.DURING && normalizedActualHour >= 12 && mentionedHour <= 11) {
      // 모호한 8시/9시 요청을 실제 배치된 오후 시간으로 정렬한다.
      return text.replaceAll("\\b" + mentionedHour + "\\s*시", normalizedActualHour + "시");
    }
    return text;
  }

  private boolean rewriteTodoFieldsByRelation(
      JsonNode todoNode, String eventLabel, RelationToEvent relation) {
    if (!(todoNode instanceof com.fasterxml.jackson.databind.node.ArrayNode arrayNode))
      return false;
    boolean changed = false;
    for (JsonNode item : arrayNode) {
      if (!(item instanceof com.fasterxml.jackson.databind.node.ObjectNode objectNode)) continue;
      String title = objectNode.path("title").asText("");
      if (!title.isBlank()) {
        String rewrittenTitle = rewriteDescriptionByRelation(title, eventLabel, relation);
        if (!rewrittenTitle.equals(title)) {
          objectNode.put("title", rewrittenTitle);
          changed = true;
        }
      }
      String description = objectNode.path("description").asText("");
      if (description.isBlank()) continue;
      String rewritten = rewriteDescriptionByRelation(description, eventLabel, relation);
      if (!rewritten.equals(description)) {
        objectNode.put("description", rewritten);
        changed = true;
      }
    }
    return changed;
  }

  private LocalDateTime normalizeTodoTimeByEventContext(
      JsonNode firstTodoNode,
      com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem matchedEvent,
      String userMessage) {
    String fallbackStartAtRaw = firstTodoNode.path("startAt").asText("");
    if (fallbackStartAtRaw.isBlank()) return matchedEvent.startAt();
    if (!(firstTodoNode
        instanceof com.fasterxml.jackson.databind.node.ObjectNode firstTodoObjectNode)) {
      return LocalDateTime.parse(fallbackStartAtRaw);
    }
    String startAtRaw = firstTodoObjectNode.path("startAt").asText("");
    String endAtRaw = firstTodoObjectNode.path("endAt").asText("");
    if (startAtRaw.isBlank() || endAtRaw.isBlank()) return LocalDateTime.parse(fallbackStartAtRaw);
    LocalDateTime startAt = LocalDateTime.parse(startAtRaw);
    LocalDateTime endAt = LocalDateTime.parse(endAtRaw);
    if (!endAt.isAfter(startAt)) return startAt;
    if (userMessage == null || userMessage.isBlank()) return startAt;
    String safeMessage = userMessage.toLowerCase();
    boolean explicitBeforeIntent = safeMessage.contains("시작 전") || safeMessage.contains("전에");
    if (explicitBeforeIntent) return startAt;
    if (safeMessage.contains("오전")
        || safeMessage.contains("오후")
        || safeMessage.contains("아침")
        || safeMessage.contains("저녁")
        || safeMessage.contains("밤")) {
      return startAt;
    }
    Matcher hourMatcher = Pattern.compile("(\\d{1,2})\\s*시").matcher(safeMessage);
    if (!hourMatcher.find()) return startAt;
    int mentionedHour;
    try {
      mentionedHour = Integer.parseInt(hourMatcher.group(1));
    } catch (Exception ignored) {
      return startAt;
    }
    if (mentionedHour < 1 || mentionedHour > 12) return startAt;
    if (matchedEvent.startAt() == null || matchedEvent.endAt() == null) return startAt;

    Set<String> messageTokens = tokenize(safeMessage);
    String eventCategory = normalizeText(matchedEvent.category());
    String eventTitle = normalizeText(matchedEvent.title());
    String eventDescription = normalizeText(matchedEvent.description());
    Set<String> eventTokens = tokenize(eventCategory + " " + eventTitle + " " + eventDescription);
    int contextMatchScore = overlapScore(messageTokens, eventTokens, 2);
    if (!eventCategory.isBlank() && safeMessage.contains(eventCategory)) contextMatchScore += 3;
    if (!eventTitle.isBlank() && safeMessage.contains(eventTitle)) contextMatchScore += 2;
    if (safeMessage.contains("시간") || safeMessage.contains("때")) contextMatchScore += 1;
    if (contextMatchScore <= 0) return startAt;

    int interpretedHour =
        (matchedEvent.startAt().getHour() >= 12 && mentionedHour <= 11)
            ? mentionedHour + 12
            : mentionedHour;
    if (interpretedHour < 0 || interpretedHour > 23) return startAt;

    LocalDateTime adjustedStartAt =
        LocalDateTime.of(startAt.toLocalDate(), startAt.toLocalTime().withHour(interpretedHour));
    java.time.Duration duration = java.time.Duration.between(startAt, endAt);
    LocalDateTime adjustedEndAt = adjustedStartAt.plus(duration);
    if (!adjustedStartAt.isBefore(matchedEvent.startAt())
        && !adjustedEndAt.isAfter(matchedEvent.endAt())) {
      firstTodoObjectNode.put("startAt", adjustedStartAt.toString());
      firstTodoObjectNode.put("endAt", adjustedEndAt.toString());
      firstTodoObjectNode.put("scheduledDate", adjustedStartAt.toLocalDate().toString());
      return adjustedStartAt;
    }
    return startAt;
  }

  private String rewriteDescriptionByRelation(
      String description, String eventLabel, RelationToEvent relation) {
    String rewritten = description;
    switch (relation) {
      case DURING -> {
        rewritten = rewritten.replace("시작 전", "시간대");
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 시작 전", eventLabel + " 시간대");
          rewritten = rewritten.replace(eventLabel + " 전", eventLabel + " 시간대");
        }
      }
      case AFTER -> {
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 시작 전", eventLabel + " 이후");
          rewritten = rewritten.replace(eventLabel + " 시간대", eventLabel + " 이후");
        }
      }
      case BEFORE -> {
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 시간대", eventLabel + " 시작 전");
        }
      }
    }
    return rewritten;
  }

  private com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem findBestMatchedEvent(
      String userMessage,
      JsonNode firstTodoNode,
      LocalDateTime todoStartAt,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem> calendarEvents) {
    String normalizedMessage = normalizeText(userMessage);
    String todoTitle = normalizeText(firstTodoNode.path("title").asText(""));
    String todoDescription = normalizeText(firstTodoNode.path("description").asText(""));
    Set<String> messageTokens = tokenize(normalizedMessage);
    Set<String> todoTokens = tokenize(todoTitle + " " + todoDescription);

    int bestScore = Integer.MIN_VALUE;
    com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem bestEvent = null;
    for (com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem event : calendarEvents) {
      if (event == null || event.startAt() == null || event.endAt() == null) continue;
      String eventCategory = normalizeText(event.category());
      String eventTitle = normalizeText(event.title());
      String eventDescription = normalizeText(event.description());
      Set<String> eventTokens = tokenize(eventCategory + " " + eventTitle + " " + eventDescription);

      int score = 0;
      if (!eventCategory.isBlank() && normalizedMessage.contains(eventCategory)) score += 8;
      if (!eventCategory.isBlank() && (todoTitle + " " + todoDescription).contains(eventCategory))
        score += 5;
      score += overlapScore(messageTokens, eventTokens, 2);
      score += overlapScore(todoTokens, eventTokens, 2);
      if (todoStartAt.toLocalDate().equals(event.startAt().toLocalDate())) score += 3;
      if (!todoStartAt.isBefore(event.startAt()) && todoStartAt.isBefore(event.endAt())) score += 4;

      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }
    return bestScore > 0 ? bestEvent : null;
  }

  private int overlapScore(Set<String> leftTokens, Set<String> rightTokens, int perToken) {
    if (leftTokens.isEmpty() || rightTokens.isEmpty()) return 0;
    int overlap = 0;
    for (String token : leftTokens) {
      if (rightTokens.contains(token)) overlap++;
    }
    return overlap * perToken;
  }

  private String rewriteNarrativeByRelation(
      String text,
      String eventLabel,
      RelationToEvent relation,
      LocalDateTime eventStartAt,
      LocalDateTime eventEndAt) {
    String rewritten = text;
    switch (relation) {
      case DURING -> {
        rewritten = rewritten.replace("시작 전", "시간대에");
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 전", eventLabel + " 시간대에");
          rewritten = rewritten.replace(eventLabel + " 시작 전", eventLabel + " 시간대에");
        }
        if (rewritten.equals(text)) {
          rewritten +=
              "\n\n※ 실제 배치는 "
                  + eventLabel
                  + " 시간대("
                  + eventStartAt.toLocalTime()
                  + "~"
                  + eventEndAt.toLocalTime()
                  + ") 기준으로 반영했습니다.";
        }
      }
      case BEFORE -> {
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 시간대에", eventLabel + " 시작 전");
        }
      }
      case AFTER -> {
        if (!eventLabel.isBlank()) {
          rewritten = rewritten.replace(eventLabel + " 시작 전", eventLabel + " 이후");
          rewritten = rewritten.replace(eventLabel + " 시간대에", eventLabel + " 이후");
        }
      }
    }
    return rewritten;
  }

  private RelationToEvent determineRelationToEvent(
      LocalDateTime todoStartAt, LocalDateTime eventStartAt, LocalDateTime eventEndAt) {
    if (todoStartAt.isBefore(eventStartAt)) return RelationToEvent.BEFORE;
    if (todoStartAt.isBefore(eventEndAt)) return RelationToEvent.DURING;
    return RelationToEvent.AFTER;
  }

  private String buildEventLabel(
      com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem event) {
    String category = event.category() == null ? "" : event.category().trim();
    if (!category.isBlank() && !looksLikeMachineCategory(category)) return category;
    String title = event.title() == null ? "" : event.title().trim();
    if (!title.isBlank()) return title;
    if (!category.isBlank()) return category;
    return "일정";
  }

  private boolean looksLikeMachineCategory(String category) {
    String normalizedCategory = category == null ? "" : category.trim();
    if (normalizedCategory.isBlank()) return false;
    // 영문 대문자/언더스코어 위주 코드를 사용자 노출 라벨에서 제외한다. (예: JOB, WORK_SHIFT)
    return normalizedCategory.matches("^[A-Z0-9_\\-]{2,}$");
  }

  private String normalizeText(String value) {
    if (value == null) return "";
    return value.toLowerCase().trim();
  }

  private Set<String> tokenize(String text) {
    Set<String> tokens = new HashSet<>();
    if (text == null || text.isBlank()) return tokens;
    for (String raw : text.split("[\\s,./()~\\-:]+")) {
      String token = raw.trim();
      if (token.length() < 2) continue;
      tokens.add(token);
    }
    return tokens;
  }

  private enum RelationToEvent {
    BEFORE,
    DURING,
    AFTER
  }

  public List<String> buildTodoProgressNotes(Long userId, Long agentId, String userMessage) {
    List<String> notes = new ArrayList<>();
    CachedTodoPlanningSummary cachedSummary =
        getCachedTodoPlanningSummary(userId, agentId, userMessage);
    if (cachedSummary != null) {
      String rangeLabel =
          formatRangeLabel(cachedSummary.contextStartDate(), cachedSummary.contextEndDate());
      notes.add("요청에서 날짜 범위를 먼저 확인하고 있어요.");
      notes.add(rangeLabel + "의 고정 일정을 확인하고 있어요.");
      notes.add(rangeLabel + "의 기존 TODO를 확인하고 있어요.");
      notes.add(
          "에이전트 담당 TODO의 연속성과 우선순위를 분석하고 있어요. (에이전트 TODO " + cachedSummary.agentTodoCount() + "건)");
      notes.add("사용자 시간 제약(dayStart/dayEnd)을 반영하고 있어요.");
      if (!cachedSummary.skipEnhancementPlanning()) {
        notes.addAll(mapCommandNotes(cachedSummary.plannedCommands()));
      } else {
        notes.add("요청이 단순해 플래닝 단계를 축약하고 바로 추천안을 만들고 있어요.");
      }
      notes.add("우선순위와 시간 충돌을 정리해서 추천안을 만들고 있어요.");
      return notes;
    }

    LocalDate[] quickRange = resolveDateRange(userMessage, List.of());
    String rangeLabel = formatRangeLabel(quickRange[0], quickRange[1]);
    notes.add("요청에서 날짜 범위를 먼저 확인하고 있어요.");
    notes.add(rangeLabel + "의 고정 일정을 확인하고 있어요.");
    notes.add(rangeLabel + "의 기존 TODO를 확인하고 있어요.");
    notes.add("에이전트 담당 TODO의 연속성과 우선순위를 분석하고 있어요.");
    notes.add("사용자 시간 제약(dayStart/dayEnd)을 반영하고 있어요.");
    notes.add("플래닝 컨텍스트를 준비하고 있어요.");
    notes.add("우선순위와 시간 충돌을 정리해서 추천안을 만들고 있어요.");
    return notes;
  }

  private void cacheTodoPlanningSummary(
      Long userId,
      Long agentId,
      String userMessage,
      LocalDate contextStartDate,
      LocalDate contextEndDate,
      int calendarEventCount,
      int existingTodoCount,
      int agentTodoCount,
      List<String> plannedCommands,
      boolean skipEnhancementPlanning) {
    String key = buildTodoSummaryCacheKey(userId, agentId, userMessage);
    todoPlanningSummaryCache.put(
        key,
        new CachedTodoPlanningSummary(
            contextStartDate,
            contextEndDate,
            calendarEventCount,
            existingTodoCount,
            agentTodoCount,
            plannedCommands == null ? List.of() : List.copyOf(plannedCommands),
            skipEnhancementPlanning,
            System.currentTimeMillis() + TODO_SUMMARY_CACHE_TTL_MS));
  }

  private CachedTodoPlanningSummary getCachedTodoPlanningSummary(
      Long userId, Long agentId, String userMessage) {
    String key = buildTodoSummaryCacheKey(userId, agentId, userMessage);
    CachedTodoPlanningSummary cached = todoPlanningSummaryCache.get(key);
    if (cached == null) return null;
    if (cached.expiresAt() <= System.currentTimeMillis()) {
      todoPlanningSummaryCache.remove(key);
      return null;
    }
    return cached;
  }

  private String buildTodoSummaryCacheKey(Long userId, Long agentId, String userMessage) {
    String normalizedMessage = userMessage == null ? "" : userMessage.trim().toLowerCase();
    return userId + "::" + agentId + "::" + normalizedMessage;
  }

  private boolean shouldSkipTodoEnhancementPlanning(
      String userMessage, int calendarEventCount, int existingTodoCount, int agentTodoCount) {
    String safeMessage = userMessage == null ? "" : userMessage.trim();
    if (safeMessage.isBlank()) return true;
    if (isSimpleTodoCreationRequest(safeMessage)) return true;
    boolean explicitComplexityHint =
        safeMessage.contains("재배치")
            || safeMessage.contains("조정")
            || safeMessage.contains("충돌")
            || safeMessage.contains("우선순위")
            || safeMessage.contains("분할");
    if (explicitComplexityHint) return false;
    boolean shortAndSimple = safeMessage.length() <= 48;
    boolean lowContextLoad =
        calendarEventCount <= 3 && existingTodoCount <= 8 && agentTodoCount <= 6;
    return shortAndSimple || lowContextLoad;
  }

  private List<String> planTodoEnhancementCommands(
      String userMessage,
      int calendarEventCount,
      int existingTodoCount,
      int agentTodoCount,
      LocalDate contextStartDate,
      LocalDate contextEndDate) {
    try {
      List<Message> messages = new ArrayList<>();
      messages.add(
          new Message(
              "system",
              """
              너는 TODO 계획 강화용 툴 실행 플래너다.
              아래 커맨드 중 필요한 것만 순서대로 선택해 JSON으로만 반환하라.

              [commands]
              - rank_task_priority
              - detect_overload
              - estimate_task_effort
              - split_task
              - insert_buffer_blocks
              - commute_aware_schedule
              - deadline_risk_score
              - explain_plan_brief

              출력 스키마:
              {"commands":["rank_task_priority","detect_overload"]}
              """));
      messages.add(
          new Message(
              "user",
              objectMapper.writeValueAsString(
                  Map.of(
                      "userMessage",
                      userMessage == null ? "" : userMessage,
                      "calendarEventCount",
                      calendarEventCount,
                      "existingTodoCount",
                      existingTodoCount,
                      "agentTodoCount",
                      agentTodoCount,
                      "contextStartDate",
                      contextStartDate.toString(),
                      "contextEndDate",
                      contextEndDate.toString()))));
      String raw = openAiClient.createInferenceChatCompletionWithMessages(messages);
      String json = extractJsonObject(raw);
      if (json == null) return List.of("rank_task_priority", "detect_overload");
      JsonNode root = objectMapper.readTree(json);
      JsonNode commandsNode = root.path("commands");
      if (!commandsNode.isArray() || commandsNode.isEmpty()) {
        return List.of("rank_task_priority", "detect_overload");
      }
      List<String> commands = new ArrayList<>();
      for (JsonNode node : commandsNode) {
        String command = node.asText("");
        if (command == null || command.isBlank()) continue;
        commands.add(command.trim());
      }
      if (commands.isEmpty()) return List.of("rank_task_priority", "detect_overload");
      log.info("❤️ [에이전트 TODO] 강화 커맨드 계획 완료 commands={}", commands);
      return commands;
    } catch (Exception e) {
      log.warn("❤️ [에이전트 TODO] 강화 커맨드 계획 실패, 기본값으로 대체 message={}", e.getMessage());
      return List.of("rank_task_priority", "detect_overload");
    }
  }

  private boolean isSimpleTodoCreationRequest(String userMessage) {
    String safeMessage = userMessage == null ? "" : userMessage.trim();
    if (safeMessage.isBlank()) return true;
    boolean explicitComplexityHint =
        safeMessage.contains("재배치")
            || safeMessage.contains("조정")
            || safeMessage.contains("충돌")
            || safeMessage.contains("우선순위")
            || safeMessage.contains("분할")
            || safeMessage.contains("재계획");
    if (explicitComplexityHint) return false;
    boolean simpleActionVerb =
        safeMessage.contains("넣어")
            || safeMessage.contains("추가")
            || safeMessage.contains("만들어")
            || safeMessage.contains("배치")
            || safeMessage.contains("잡아");
    boolean hasRelativeTimeHint =
        safeMessage.contains("오늘")
            || safeMessage.contains("내일")
            || safeMessage.contains("모레")
            || safeMessage.contains("이번주")
            || safeMessage.contains("시쯤")
            || safeMessage.contains("시");
    return simpleActionVerb && hasRelativeTimeHint;
  }

  private int resolveEnhancementCommandLimit(
      String userMessage, int calendarEventCount, int existingTodoCount, int agentTodoCount) {
    if (isSimpleTodoCreationRequest(userMessage)) return 0;
    String safeMessage = userMessage == null ? "" : userMessage.trim();
    boolean explicitComplexityHint =
        safeMessage.contains("재배치")
            || safeMessage.contains("조정")
            || safeMessage.contains("충돌")
            || safeMessage.contains("우선순위")
            || safeMessage.contains("분할")
            || safeMessage.contains("리스크");
    if (explicitComplexityHint) return 2;
    boolean highContextLoad =
        calendarEventCount >= 6 || existingTodoCount >= 14 || agentTodoCount >= 10;
    return highContextLoad ? 2 : 1;
  }

  private List<String> sanitizePlannedCommands(List<String> plannedCommands, int maxCommands) {
    if (plannedCommands == null || plannedCommands.isEmpty() || maxCommands <= 0) return List.of();
    List<String> allowedOrder =
        List.of(
            "rank_task_priority",
            "detect_overload",
            "estimate_task_effort",
            "split_task",
            "insert_buffer_blocks",
            "commute_aware_schedule",
            "deadline_risk_score",
            "explain_plan_brief");
    Set<String> allowedSet = new HashSet<>(allowedOrder);
    List<String> normalized = new ArrayList<>();
    for (String command : plannedCommands) {
      if (command == null || command.isBlank()) continue;
      String normalizedCommand = command.trim();
      if (!allowedSet.contains(normalizedCommand)) continue;
      if (normalized.contains(normalizedCommand)) continue;
      normalized.add(normalizedCommand);
      if (normalized.size() >= maxCommands) break;
    }
    if (!normalized.isEmpty()) return normalized;
    return maxCommands >= 2
        ? List.of("rank_task_priority", "detect_overload")
        : List.of("rank_task_priority");
  }

  private Map<String, Object> executeTodoEnhancementCommands(
      Long userId,
      String userMessage,
      List<String> commands,
      LocalDate contextStartDate,
      LocalDate contextEndDate,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> existingTodos,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> agentTodos) {
    Map<String, Object> results = new java.util.LinkedHashMap<>();
    List<PriorityRankItem> seedRankItems = new ArrayList<>();
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> sourceTodos =
        (agentTodos == null || agentTodos.isEmpty()) ? existingTodos : agentTodos;
    for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : sourceTodos) {
      if (todo == null) continue;
      int score = 50;
      if (todo.title() != null && (todo.title().contains("시험") || todo.title().contains("기출")))
        score += 20;
      seedRankItems.add(new PriorityRankItem(todo.id(), todo.title(), "MEDIUM", score, "초기 점수"));
    }
    List<ReschedulePlanItem> scheduleItems = new ArrayList<>();
    for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : sourceTodos) {
      if (todo == null || todo.startAt() == null || todo.endAt() == null) continue;
      scheduleItems.add(
          new ReschedulePlanItem(
              todo.id(),
              todo.title(),
              todo.startAt(),
              todo.endAt(),
              todo.startAt(),
              todo.endAt(),
              "UNCHANGED",
              "기존 일정"));
    }

    for (String command : commands) {
      try {
        switch (command) {
          case "rank_task_priority" -> {
            PriorityRankResponse ranked =
                agentPlanningToolService.rankTaskPriority(
                    new PriorityRankRequest(seedRankItems, userMessage));
            results.put(command, ranked);
          }
          case "detect_overload" -> {
            OverloadDetectResponse overload =
                agentPlanningToolService.detectOverload(
                    userId, new OverloadDetectRequest(contextStartDate, contextEndDate, 480, 120));
            results.put(command, overload);
          }
          case "estimate_task_effort" -> {
            String taskText = userMessage == null ? "" : userMessage;
            if (!sourceTodos.isEmpty()
                && sourceTodos.get(0) != null
                && sourceTodos.get(0).title() != null) {
              taskText = sourceTodos.get(0).title();
            }
            TaskEffortEstimateResponse estimate =
                agentPlanningToolService.estimateTaskEffort(
                    new TaskEffortEstimateRequest(taskText, "medium"));
            results.put(command, estimate);
          }
          case "split_task" -> {
            SplitTaskResponse split =
                agentPlanningToolService.splitTask(
                    new SplitTaskRequest("집중 학습", null, 120, 30, "balanced"));
            results.put(command, split);
          }
          case "insert_buffer_blocks" -> {
            BufferInsertResponse buffered =
                agentPlanningToolService.insertBufferBlocks(
                    new BufferInsertRequest(scheduleItems, 10, "standard"));
            results.put(command, buffered);
          }
          case "commute_aware_schedule" -> {
            CommuteAwareResponse commuteAware =
                agentPlanningToolService.commuteAwareSchedule(
                    new CommuteAwareRequest(scheduleItems, 20, null));
            results.put(command, commuteAware);
          }
          case "deadline_risk_score" -> {
            DeadlineRiskResponse risk =
                agentPlanningToolService.getDeadlineRiskScore(
                    new DeadlineRiskRequest("goal-default", 14));
            results.put(command, risk);
          }
          case "explain_plan_brief" -> {
            String brief =
                agentPlanningToolService.explainPlanBrief(
                    new ExplainBriefRequest("summary", "TODO 계획 강화 분석"));
            results.put(command, brief);
          }
          default -> results.put(command, "unsupported_command");
        }
      } catch (Exception e) {
        results.put(command, "error: " + e.getMessage());
      }
    }
    return results;
  }

  private List<String> mapCommandNotes(List<String> commands) {
    List<String> notes = new ArrayList<>();
    for (String command : commands) {
      String note =
          switch (command) {
            case "rank_task_priority" -> "우선순위 스코어를 계산하고 있어요.";
            case "detect_overload" -> "하루 과부하 여부를 점검하고 있어요.";
            case "estimate_task_effort" -> "작업 소요 시간을 추정하고 있어요.";
            case "split_task" -> "긴 작업을 실행 가능한 블록으로 분할하고 있어요.";
            case "insert_buffer_blocks" -> "집중 블록 사이 버퍼 시간을 삽입하고 있어요.";
            case "commute_aware_schedule" -> "이동 시간을 고려해 충돌을 재확인하고 있어요.";
            case "deadline_risk_score" -> "마감 리스크를 점검하고 있어요.";
            case "explain_plan_brief" -> "계획 요약 문구를 정리하고 있어요.";
            default -> null;
          };
      if (note != null) notes.add(note);
    }
    return notes;
  }

  private List<Long> inferNegotiationTargetTodoIds(
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todos,
      LocalDate fallbackMonthDate) {
    String safeMessage = userMessage == null ? "" : userMessage;
    List<Long> aiTargetIds =
        inferNegotiationTargetTodoIdsByAi(safeMessage, todos, fallbackMonthDate);
    if (!aiTargetIds.isEmpty()) {
      log.info("❤️ [에이전트 조정] AI 타깃 선택 완료 targetTodoIds={}", aiTargetIds);
      return aiTargetIds;
    }
    List<Long> ruleTargetIds =
        inferNegotiationTargetTodoIdsByRule(safeMessage, todos, fallbackMonthDate);
    log.info("❤️ [에이전트 조정] 룰 타깃 선택 완료 targetTodoIds={}", ruleTargetIds);
    return ruleTargetIds;
  }

  private NegotiationIntentPlan planNegotiationIntent(
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todos,
      LocalDate fallbackMonthDate) {
    List<Long> fallbackTargetIds =
        inferNegotiationTargetTodoIds(userMessage, todos, fallbackMonthDate);
    Integer fallbackShiftMinutes = inferShiftMinutesByRule(userMessage);
    if (todos == null || todos.isEmpty()) {
      return new NegotiationIntentPlan(
          ChatMode.TODO_NEGOTIATION,
          fallbackTargetIds,
          fallbackShiftMinutes,
          0.0,
          "no_todos_context");
    }
    try {
      LocalDate hintedDate =
          inferDayHintDate(userMessage == null ? "" : userMessage.toLowerCase(), fallbackMonthDate);
      List<Message> messages = new ArrayList<>();
      messages.add(
          new Message(
              "system",
              """
              너는 조정 요청 통합 추론기다.
              아래 항목을 한 번에 판단해서 JSON만 반환하라.

              출력 스키마:
              {
                "mode": "CHAT" | "TODO" | "TODO_NEGOTIATION",
                "targetTodoIds": [1,2],
                "shiftMinutes": 0,
                "confidence": 0.0,
                "reason": "string"
              }

              규칙:
              - 후보 id는 제공된 todos.id 안에서만 선택한다.
              - "1시간만/30분만" 같은 표현은 shiftMinutes로 반영한다.
              - 단일 조정 요청이면 targetTodoIds는 가능하면 1개로 제한한다.
              - 모호하면 targetTodoIds는 빈 배열로 둔다.
              - 마크다운/코드블록 금지.
              """));
      messages.add(
          new Message(
              "user",
              objectMapper.writeValueAsString(
                  Map.of(
                      "userMessage",
                      userMessage == null ? "" : userMessage,
                      "hintedDate",
                      hintedDate == null ? "" : hintedDate.toString(),
                      "singleAdjustmentHint",
                      isSingleTodoAdjustmentRequest(
                          userMessage == null ? "" : userMessage.toLowerCase()),
                      "todos",
                      todos))));
      String raw = openAiClient.createInferenceChatCompletionWithMessages(messages);
      String json = extractJsonObject(raw);
      if (json == null) {
        return new NegotiationIntentPlan(
            ChatMode.TODO_NEGOTIATION,
            fallbackTargetIds,
            fallbackShiftMinutes,
            0.0,
            "invalid_json");
      }
      JsonNode root = objectMapper.readTree(json);
      double confidence = root.path("confidence").asDouble(0.0);
      String reason = root.path("reason").asText("");
      ChatMode mode = parsePlannedMode(root.path("mode").asText(""));
      Integer shiftMinutes =
          root.path("shiftMinutes").isNumber() ? root.path("shiftMinutes").asInt() : null;
      if (shiftMinutes == null || shiftMinutes <= 0) shiftMinutes = fallbackShiftMinutes;

      List<Long> allowedTodoIds = new ArrayList<>();
      for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : todos) {
        if (todo == null || todo.id() == null) continue;
        allowedTodoIds.add(todo.id());
      }
      List<Long> aiTargetIds = new ArrayList<>();
      JsonNode targetNode = root.path("targetTodoIds");
      if (targetNode.isArray()) {
        for (JsonNode node : targetNode) {
          if (!node.canConvertToLong()) continue;
          long id = node.asLong();
          if (allowedTodoIds.contains(id)) aiTargetIds.add(id);
        }
      }
      List<Long> targetIds =
          confidence >= 0.55d && !aiTargetIds.isEmpty() ? aiTargetIds : fallbackTargetIds;
      if (isSingleTodoAdjustmentRequest(userMessage == null ? "" : userMessage.toLowerCase())
          && targetIds.size() > 1) {
        targetIds = List.of(targetIds.get(0));
      }
      return new NegotiationIntentPlan(mode, targetIds, shiftMinutes, confidence, reason);
    } catch (Exception e) {
      log.warn("❤️ [에이전트 조정] 통합 추론 실패, 폴백 적용 message={}", e.getMessage());
      return new NegotiationIntentPlan(
          ChatMode.TODO_NEGOTIATION, fallbackTargetIds, fallbackShiftMinutes, 0.0, "exception");
    }
  }

  private ChatMode parsePlannedMode(String rawMode) {
    if (rawMode == null || rawMode.isBlank()) return ChatMode.TODO_NEGOTIATION;
    try {
      return ChatMode.valueOf(rawMode.trim().toUpperCase());
    } catch (Exception ignored) {
      return ChatMode.TODO_NEGOTIATION;
    }
  }

  private Integer inferShiftMinutesByRule(String userMessage) {
    if (userMessage == null || userMessage.isBlank()) return null;
    String safeMessage = userMessage.toLowerCase();
    if (safeMessage.contains("2시간")) return 120;
    if (safeMessage.contains("1시간") || safeMessage.contains("한시간")) return 60;
    if (safeMessage.contains("30분")) return 30;
    return null;
  }

  private void emitProgress(Consumer<String> progressEmitter, String message) {
    if (progressEmitter == null || message == null || message.isBlank()) return;
    progressEmitter.accept(message);
  }

  private String buildTimeInterpretationHint(
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem> calendarEvents,
      LocalDate contextStartDate,
      LocalDate contextEndDate) {
    if (userMessage == null || userMessage.isBlank()) return "";
    String safeMessage = userMessage.toLowerCase();
    Matcher hourMatcher = Pattern.compile("(\\d{1,2})\\s*시").matcher(safeMessage);
    if (!hourMatcher.find()) return "";
    int mentionedHour;
    try {
      mentionedHour = Integer.parseInt(hourMatcher.group(1));
    } catch (Exception ignored) {
      return "";
    }
    if (mentionedHour < 1 || mentionedHour > 12) return "";

    boolean explicitlyMorning =
        safeMessage.contains("오전")
            || safeMessage.contains("아침")
            || safeMessage.contains("새벽")
            || safeMessage.contains("낮");
    boolean explicitlyEvening =
        safeMessage.contains("오후")
            || safeMessage.contains("저녁")
            || safeMessage.contains("밤")
            || safeMessage.contains("야간");
    if (explicitlyMorning || explicitlyEvening) return "";
    if (calendarEvents == null || calendarEvents.isEmpty()) return "";

    Set<String> messageTokens = tokenize(safeMessage);
    com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem bestMatchedEvent = null;
    int bestScore = Integer.MIN_VALUE;
    for (com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem event : calendarEvents) {
      if (event == null || event.startAt() == null || event.endAt() == null) continue;
      LocalDate eventDate = event.date();
      if (eventDate == null) eventDate = event.startAt().toLocalDate();
      if (eventDate == null) continue;
      if (eventDate.isBefore(contextStartDate) || eventDate.isAfter(contextEndDate)) continue;

      String category = event.category() == null ? "" : event.category().toLowerCase();
      String title = event.title() == null ? "" : event.title().toLowerCase();
      String description = event.description() == null ? "" : event.description().toLowerCase();
      int workStartHour = event.startAt().getHour();
      int workEndHour = event.endAt().getHour();
      int interpretedHour = mentionedHour;
      if (mentionedHour <= 11 && workStartHour >= 12) {
        interpretedHour = mentionedHour + 12;
      }
      if (interpretedHour < workStartHour || interpretedHour > workEndHour) continue;

      Set<String> eventTokens = tokenize(category + " " + title + " " + description);
      int overlapScore = overlapScore(messageTokens, eventTokens, 2);
      int score = overlapScore;
      if (!category.isBlank() && safeMessage.contains(category)) score += 4;
      if (!title.isBlank() && safeMessage.contains(title)) score += 3;
      if (safeMessage.contains("시간") || safeMessage.contains("때")) score += 1;
      if (eventDate.equals(LocalDate.now(PLANNER_ZONE_ID))) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestMatchedEvent = event;
      }
    }

    if (bestMatchedEvent == null) return "";
    String category =
        bestMatchedEvent.category() == null ? "" : bestMatchedEvent.category().toLowerCase();
    String title = bestMatchedEvent.title() == null ? "" : bestMatchedEvent.title().toLowerCase();
    int interpretedHour = mentionedHour;
    if (mentionedHour <= 11 && bestMatchedEvent.startAt().getHour() >= 12) {
      interpretedHour = mentionedHour + 12;
    }
    String contextLabel = !category.isBlank() ? category : (!title.isBlank() ? title : "관련 일정");
    return "- 시간 해석 규칙: 사용자가 '"
        + contextLabel
        + "' 문맥에서 '"
        + mentionedHour
        + "시'라고 말하고 오전/오후를 명시하지 않으면, 해당 날짜 관련 일정 시간대를 기준으로 해석하라. "
        + "이번 요청에서는 "
        + interpretedHour
        + ":00(24시간제)로 배치하라.";
  }

  private List<Long> inferNegotiationTargetTodoIdsByRule(
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todos,
      LocalDate fallbackMonthDate) {
    if (todos == null || todos.isEmpty()) return List.of();
    String safeMessage = userMessage == null ? "" : userMessage.toLowerCase();
    LocalDate hintedDate = inferDayHintDate(safeMessage, fallbackMonthDate);

    List<String> tokens = new ArrayList<>();
    for (String raw : safeMessage.split("[\\s,./()]+")) {
      String token = raw.trim();
      if (token.length() < 2) continue;
      if (token.equals("일정")
          || token.equals("조정")
          || token.equals("해주세요")
          || token.equals("미뤄")
          || token.equals("미뤄주세요")
          || token.equals("선생님")) continue;
      tokens.add(token);
    }

    List<Long> matchedIds = new ArrayList<>();
    long bestTodoId = -1L;
    int bestScore = 0;
    for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : todos) {
      if (todo == null || todo.id() == null) continue;
      if (hintedDate != null && todo.date() != null && !hintedDate.equals(todo.date())) continue;
      String title = todo.title() == null ? "" : todo.title().toLowerCase();
      String description = todo.description() == null ? "" : todo.description().toLowerCase();
      String combined = title + " " + description;
      int score = 0;
      for (String token : tokens) {
        if (combined.contains(token)) {
          score += 1;
          if (token.length() >= 3) score += 1;
          if (title.contains(token)) score += 1;
        }
      }
      if (score > 0) {
        matchedIds.add(todo.id());
        if (score > bestScore) {
          bestScore = score;
          bestTodoId = todo.id();
        }
      }
    }
    if (isSingleTodoAdjustmentRequest(safeMessage) && bestTodoId > 0L) {
      return List.of(bestTodoId);
    }
    return matchedIds;
  }

  private List<Long> inferNegotiationTargetTodoIdsByAi(
      String userMessage,
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todos,
      LocalDate fallbackMonthDate) {
    if (todos == null || todos.isEmpty()) return List.of();
    try {
      LocalDate hintedDate =
          inferDayHintDate(userMessage == null ? "" : userMessage.toLowerCase(), fallbackMonthDate);
      List<Message> messages = new ArrayList<>();
      messages.add(
          new Message(
              "system",
              """
              너는 일정 조정 타깃 추론 에이전트다.
              사용자의 자연어 조정 요청에서 실제로 수정할 TODO id를 추론하라.
              반드시 JSON만 반환하라.

              출력 스키마:
              {
                "targetTodoIds": [1,2],
                "confidence": 0.0,
                "reason": "string"
              }

              규칙:
              - 후보는 제공된 todos의 id 안에서만 선택한다.
              - 단일 조정 표현(예: "1시간만 미뤄", "하나만")이면 가능한 1개만 선택한다.
              - 모호하면 빈 배열을 반환한다.
              - 마크다운/코드블록 금지.
              """));
      java.util.LinkedHashMap<String, Object> aiInput = new java.util.LinkedHashMap<>();
      aiInput.put("userMessage", userMessage == null ? "" : userMessage);
      aiInput.put("hintedDate", hintedDate == null ? null : hintedDate.toString());
      aiInput.put(
          "singleAdjustmentHint",
          isSingleTodoAdjustmentRequest(userMessage == null ? "" : userMessage.toLowerCase()));
      aiInput.put("todos", todos);
      messages.add(new Message("user", objectMapper.writeValueAsString(aiInput)));
      String raw = openAiClient.createInferenceChatCompletionWithMessages(messages);
      String json = extractJsonObject(raw);
      if (json == null) return List.of();
      JsonNode root = objectMapper.readTree(json);
      double confidence = root.path("confidence").asDouble(0.0);
      String reason = root.path("reason").asText("");
      JsonNode idsNode = root.path("targetTodoIds");
      if (!idsNode.isArray() || idsNode.isEmpty()) {
        log.info("❤️ [에이전트 조정] AI 타깃 비어 있음 confidence={}, reason={}", confidence, reason);
        return List.of();
      }

      List<Long> todoIdsFromContext = new ArrayList<>();
      for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : todos) {
        if (todo == null || todo.id() == null) continue;
        todoIdsFromContext.add(todo.id());
      }
      List<Long> filteredIds = new ArrayList<>();
      for (JsonNode node : idsNode) {
        if (!node.canConvertToLong()) continue;
        long id = node.asLong();
        if (todoIdsFromContext.contains(id)) filteredIds.add(id);
      }
      if (filteredIds.isEmpty()) return List.of();
      if (confidence < 0.55d) {
        log.info(
            "❤️ [에이전트 조정] AI 신뢰도 낮아 폴백 예정 confidence={}, reason={}, ids={}",
            confidence,
            reason,
            filteredIds);
        return List.of();
      }
      if (isSingleTodoAdjustmentRequest(userMessage == null ? "" : userMessage.toLowerCase())) {
        return List.of(filteredIds.get(0));
      }
      return filteredIds;
    } catch (Exception e) {
      log.warn("❤️ [에이전트 조정] AI 타깃 추론 실패, 룰 폴백 적용 message={}", e.getMessage());
      return List.of();
    }
  }

  private LocalDate inferDayHintDate(String userMessageLower, LocalDate fallbackMonthDate) {
    if (userMessageLower == null || userMessageLower.isBlank()) return null;
    Matcher matcher = DAY_ONLY_PATTERN.matcher(userMessageLower);
    if (!matcher.find()) return null;
    try {
      int dayOfMonth = Integer.parseInt(matcher.group(1));
      if (dayOfMonth <= 0 || dayOfMonth > 31) return null;
      LocalDate base =
          fallbackMonthDate == null ? LocalDate.now(PLANNER_ZONE_ID) : fallbackMonthDate;
      return LocalDate.of(base.getYear(), base.getMonthValue(), dayOfMonth);
    } catch (Exception ignored) {
      return null;
    }
  }

  private boolean isSingleTodoAdjustmentRequest(String userMessageLower) {
    if (userMessageLower == null || userMessageLower.isBlank()) return false;
    boolean hasSingleShiftHint =
        userMessageLower.contains("1시간만")
            || userMessageLower.contains("한시간만")
            || userMessageLower.contains("30분만")
            || userMessageLower.contains("만 미뤄")
            || userMessageLower.contains("만 늦춰");
    boolean hasPluralHint =
        userMessageLower.contains("여러")
            || userMessageLower.contains("전체")
            || userMessageLower.contains("다 ")
            || userMessageLower.contains("모두")
            || userMessageLower.contains("전부");
    return hasSingleShiftHint && !hasPluralHint;
  }

  private String resolveNegotiationGroupTitle(
      List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> todosInRange,
      List<Long> targetTodoIds,
      LocalDate startDate,
      LocalDate endDate) {
    if (todosInRange != null && targetTodoIds != null && !targetTodoIds.isEmpty()) {
      for (Long targetId : targetTodoIds) {
        if (targetId == null) continue;
        for (com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem todo : todosInRange) {
          if (todo == null || todo.id() == null) continue;
          if (!targetId.equals(todo.id())) continue;
          String existingGroupTitle = todo.groupTitle();
          if (existingGroupTitle != null && !existingGroupTitle.trim().isBlank()) {
            return existingGroupTitle.trim();
          }
        }
      }
    }
    return startDate.equals(endDate)
        ? "재조정 제안 (" + startDate + ")"
        : "재조정 제안 (" + startDate + " ~ " + endDate + ")";
  }

  public ChatMode routeChatMode(
      String userMessage,
      List<String> imageUrls,
      List<NegotiationTodoRequestItem> negotiationTodos) {
    if (negotiationTodos != null && !negotiationTodos.isEmpty()) {
      return ChatMode.TODO_NEGOTIATION;
    }
    if (imageUrls != null && !imageUrls.isEmpty()) {
      return ChatMode.CHAT;
    }
    try {
      List<Message> messages = new ArrayList<>();
      messages.add(
          new Message(
              "system",
              """
              너는 채팅 라우팅 에이전트다.
              아래 실행 가능한 커맨드 중 하나를 선택해 JSON으로만 답하라.

              [commands]
              - route_chat(reason)
              - route_todo_create(reason)
              - route_todo_negotiate(reason)

              출력 스키마:
              {
                "commands": [
                  { "name": "route_chat" | "route_todo_create" | "route_todo_negotiate", "reason": "string" }
                ],
                "confidence": 0.0
              }
              """));
      messages.add(new Message("user", userMessage == null ? "" : userMessage));

      String rawPlan = openAiClient.createInferenceChatCompletionWithMessages(messages);
      String planJson = extractJsonObject(rawPlan);
      if (planJson == null) return ChatMode.CHAT;
      JsonNode root = objectMapper.readTree(planJson);
      String commandName = root.path("commands").path(0).path("name").asText("");
      String reason = root.path("commands").path(0).path("reason").asText("");
      double confidence = root.path("confidence").asDouble(0.0);

      ChatMode routedMode =
          switch (commandName) {
            case "route_todo_create" -> ChatMode.TODO;
            case "route_todo_negotiate" -> ChatMode.TODO_NEGOTIATION;
            default -> ChatMode.CHAT;
          };
      log.info(
          "❤️ [에이전트 라우팅] 모드 라우팅 완료 command={}, routedMode={}, confidence={}, reason={}",
          commandName,
          routedMode,
          confidence,
          reason);
      return routedMode;
    } catch (Exception e) {
      log.warn("❤️ [에이전트 라우팅] 라우팅 실패, CHAT 폴백 message={}", e.getMessage());
      return ChatMode.CHAT;
    }
  }

  public LocalDate[] resolveDateRange(
      String userMessage, List<NegotiationTodoRequestItem> negotiationTodos) {
    LocalDate today = LocalDate.now(PLANNER_ZONE_ID);
    int currentYear = today.getYear();

    String safeMessage = userMessage == null ? "" : userMessage;
    Matcher matcher = DATE_RANGE_PATTERN.matcher(safeMessage);
    if (matcher.find()) {
      LocalDate startDate = tryParseDate(matcher.group(1), currentYear);
      LocalDate endDate = tryParseDate(matcher.group(2), currentYear);
      if (startDate != null && endDate != null) {
        if (endDate.isBefore(startDate)) {
          LocalDate swap = startDate;
          startDate = endDate;
          endDate = swap;
        }
        return new LocalDate[] {startDate, endDate};
      }
    }

    Matcher singleDateMatcher = SINGLE_DATE_PATTERN.matcher(safeMessage);
    if (singleDateMatcher.find()) {
      LocalDate singleDate = tryParseDate(singleDateMatcher.group(1), currentYear);
      if (singleDate != null) {
        return new LocalDate[] {singleDate, singleDate};
      }
    }

    LocalDate minDate = null;
    LocalDate maxDate = null;
    if (negotiationTodos != null) {
      for (NegotiationTodoRequestItem item : negotiationTodos) {
        if (item == null || item.occurrenceDate() == null || item.occurrenceDate().isBlank())
          continue;
        LocalDate parsed = tryParseDate(item.occurrenceDate(), currentYear);
        if (parsed == null) continue;
        if (minDate == null || parsed.isBefore(minDate)) minDate = parsed;
        if (maxDate == null || parsed.isAfter(maxDate)) maxDate = parsed;
      }
    }
    if (minDate != null && maxDate != null) {
      return new LocalDate[] {minDate, maxDate};
    }

    return new LocalDate[] {today, today.plusDays(2)};
  }

  public LocalDate[] resolveTodoLookupRange(
      Long userId, String userMessage, LocalDate requestStartDate, LocalDate requestEndDate) {
    LocalDate today = LocalDate.now(PLANNER_ZONE_ID);
    String safeMessage = userMessage == null ? "" : userMessage;
    boolean hasPreDayIntent =
        safeMessage.contains("전날")
            || safeMessage.contains("직전")
            || safeMessage.contains("대비")
            || safeMessage.contains("준비");
    boolean hasExamIntent = safeMessage.contains("시험");
    boolean hasExplicitDateExpression = containsExplicitDateExpression(safeMessage);

    log.info(
        "❤️ [에이전트 TODO 조회범위] 시작 userId={}, hasPreDayIntent={}, hasExamIntent={}, hasExplicitDateExpression={}, requestRange={}~{}",
        userId,
        hasPreDayIntent,
        hasExamIntent,
        hasExplicitDateExpression,
        requestStartDate,
        requestEndDate);

    if ((hasPreDayIntent || hasExamIntent) && !hasExplicitDateExpression) {
      LocalDate inferredExamDate = getCachedOrInferUpcomingExamDate(userId, safeMessage);
      if (inferredExamDate != null) {
        LocalDate inferredEnd = inferredExamDate.minusDays(1);
        if (inferredEnd.isBefore(today)) {
          inferredEnd = today;
        }
        log.info(
            "❤️ [에이전트 TODO 조회범위] 시험일 추론 적용 inferredExamDate={}, selectedRange={}~{}",
            inferredExamDate,
            today,
            inferredEnd);
        return new LocalDate[] {today, inferredEnd};
      }
      log.info("❤️ [에이전트 TODO 조회범위] 시험일 추론 없음, 폴백 분기 사용");
    }

    if ((hasPreDayIntent || hasExamIntent) && requestStartDate.isAfter(today)) {
      LocalDate rangeStart = today;
      LocalDate rangeEnd = requestStartDate.minusDays(1);
      if (rangeEnd.isBefore(rangeStart)) {
        rangeEnd = requestEndDate;
      }
      log.info("❤️ [에이전트 TODO 조회범위] 의도 기반 폴백 selectedRange={}~{}", rangeStart, rangeEnd);
      return new LocalDate[] {rangeStart, rangeEnd};
    }

    LocalDate defaultStart = requestStartDate.minusDays(3);
    LocalDate defaultEnd = requestEndDate.plusDays(3);
    log.info("❤️ [에이전트 TODO 조회범위] 기본 폴백 selectedRange={}~{}", defaultStart, defaultEnd);
    return new LocalDate[] {defaultStart, defaultEnd};
  }

  public String formatRangeLabel(LocalDate startDate, LocalDate endDate) {
    if (startDate.equals(endDate)) {
      return startDate.getMonthValue() + "/" + startDate.getDayOfMonth();
    } else {
      return startDate.getMonthValue()
          + "/"
          + startDate.getDayOfMonth()
          + " ~ "
          + endDate.getMonthValue()
          + "/"
          + endDate.getDayOfMonth();
    }
  }

  private LocalDate getCachedOrInferUpcomingExamDate(Long userId, String userMessage) {
    String key = buildExamInferenceCacheKey(userId, userMessage);
    long now = System.currentTimeMillis();
    CachedExamInference cached = examInferenceCache.get(key);
    if (cached != null && cached.expiresAt() > now) {
      log.info("❤️ [에이전트 TODO 조회범위] 시험일 추론 캐시 적중 userId={}, date={}", userId, cached.examDate());
      return cached.examDate();
    }

    LocalDate inferred = inferUpcomingExamDate(userId, userMessage);
    if (inferred != null) {
      examInferenceCache.put(
          key, new CachedExamInference(inferred, now + EXAM_INFERENCE_CACHE_TTL_MS));
    }
    return inferred;
  }

  private String buildExamInferenceCacheKey(Long userId, String userMessage) {
    String normalizedMessage = userMessage == null ? "" : userMessage.trim().toLowerCase();
    return userId + "::" + normalizedMessage;
  }

  private LocalDate tryParseDate(String raw, int defaultYear) {
    if (raw == null || raw.isBlank()) return null;
    try {
      if (raw.contains("-")) {
        return LocalDate.parse(raw);
      }
      if (raw.contains("/")) {
        String[] parts = raw.split("/");
        if (parts.length != 2) return null;
        int month = Integer.parseInt(parts[0].trim());
        int day = Integer.parseInt(parts[1].trim());
        return LocalDate.of(defaultYear, month, day);
      }
      return null;
    } catch (Exception ignored) {
      return null;
    }
  }

  private boolean containsExplicitDateExpression(String text) {
    if (text == null || text.isBlank()) return false;
    return DATE_RANGE_PATTERN.matcher(text).find() || SINGLE_DATE_PATTERN.matcher(text).find();
  }

  private LocalDate inferUpcomingExamDate(Long userId, String userMessage) {
    try {
      LocalDate today = LocalDate.now(PLANNER_ZONE_ID);
      LocalDate maxDate = today.plusDays(120);
      var events = agentPlanningToolService.getCalendarEvents(userId, today, maxDate);
      var todos = agentPlanningToolService.getTodos(userId, today, maxDate, false);
      List<Message> messages = new ArrayList<>();
      messages.add(
          new Message(
              "system",
              """
              너는 일정 추론 에이전트다.
              아래 실행 가능한 커맨드만 사용한다고 가정하고, 반드시 JSON만 반환하라.

              [commands]
              - select_exam_date(targetDate, reason)
              - no_match(reason)

              응답 스키마:
              {
                "commands": [
                  {
                    "name": "select_exam_date" | "no_match",
                    "targetDate": "YYYY-MM-DD 또는 null",
                    "reason": "string"
                  }
                ]
              }

              규칙:
              - userMessage 의 맥락(과목/시험 종류)을 최대한 반영한다.
              - date 후보는 제공된 calendarEvents/todos 안에서만 고른다.
              - 못 고르면 no_match를 반환한다.
              - 마크다운, 코드블록 금지. JSON만.
              """));
      messages.add(
          new Message(
              "user",
              objectMapper.writeValueAsString(
                  Map.of(
                      "userMessage",
                      userMessage == null ? "" : userMessage,
                      "today",
                      today.toString(),
                      "calendarEvents",
                      events,
                      "todos",
                      todos))));

      String rawPlan = openAiClient.createInferenceChatCompletionWithMessages(messages);
      String planJson = extractJsonObject(rawPlan);
      if (planJson == null) return null;
      JsonNode root = objectMapper.readTree(planJson);
      JsonNode commands = root.path("commands");
      if (!commands.isArray() || commands.isEmpty()) return null;

      JsonNode command = commands.get(0);
      String name = command.path("name").asText("");
      if (!"select_exam_date".equals(name)) {
        String reason = command.path("reason").asText("");
        log.info("❤️ [에이전트 TODO 조회범위] 시험일 추론 미선택 commandName={}, reason={}", name, reason);
        return null;
      }
      LocalDate inferredDate = parseLocalDateSafe(command.path("targetDate").asText(null));
      if (inferredDate == null) {
        String reason = command.path("reason").asText("");
        log.info(
            "❤️ [에이전트 TODO 조회범위] 시험일 추론 날짜 형식 오류 targetDate={}, reason={}",
            command.path("targetDate").asText(""),
            reason);
        return null;
      }

      log.info(
          "❤️ [에이전트 TODO 조회범위] 시험일 추론 성공 aiCommand={}, inferredDate={}, events={}, todos={}",
          name,
          inferredDate,
          events.size(),
          todos.size());
      return inferredDate;
    } catch (Exception e) {
      log.warn("❤️ [에이전트 TODO 조회범위] 시험 일정 추론 실패 message={}", e.getMessage());
      return null;
    }
  }

  private String extractJsonObject(String rawText) {
    if (rawText == null || rawText.isBlank()) return null;
    String trimmed = rawText.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
    int startIdx = trimmed.indexOf('{');
    int endIdx = trimmed.lastIndexOf('}');
    if (startIdx < 0 || endIdx <= startIdx) return null;
    return trimmed.substring(startIdx, endIdx + 1);
  }

  private LocalDate parseLocalDateSafe(String rawDate) {
    if (rawDate == null || rawDate.isBlank()) return null;
    try {
      return LocalDate.parse(rawDate.trim());
    } catch (Exception ignored) {
      return null;
    }
  }

  private record CachedExamInference(LocalDate examDate, long expiresAt) {}

  private record CachedTodoPlanningSummary(
      LocalDate contextStartDate,
      LocalDate contextEndDate,
      int calendarEventCount,
      int existingTodoCount,
      int agentTodoCount,
      List<String> plannedCommands,
      boolean skipEnhancementPlanning,
      long expiresAt) {}

  private record NegotiationIntentPlan(
      ChatMode mode,
      List<Long> targetTodoIds,
      Integer shiftMinutes,
      double confidence,
      String reason) {}
}
