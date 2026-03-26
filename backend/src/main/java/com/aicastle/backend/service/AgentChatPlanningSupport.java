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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
  private static final long EXAM_INFERENCE_CACHE_TTL_MS = 15_000L;

  private final AgentPlanningToolService agentPlanningToolService;
  private final OpenAiClient openAiClient;
  private final ObjectMapper objectMapper;
  private final ConcurrentHashMap<String, CachedExamInference> examInferenceCache =
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
    LocalDate[] range = resolveDateRange(userMessage, negotiationTodos);
    LocalDate startDate = range[0];
    LocalDate endDate = range[1];

    agentPlanningToolService.getCalendarEvents(userId, startDate, endDate);
    List<Long> targetTodoIds = new ArrayList<>();
    if (negotiationTodos != null) {
      for (NegotiationTodoRequestItem item : negotiationTodos) {
        if (item == null || item.scheduleId() == null) continue;
        targetTodoIds.add(item.scheduleId());
      }
    }
    if (targetTodoIds.isEmpty()) {
      agentPlanningToolService.getTodos(userId, startDate, endDate, false);
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

    ReschedulePlanResponse simulated =
        agentPlanningToolService.simulateReschedule(
            userId,
            new RescheduleSimulateRequest(startDate, endDate, targetTodoIds, maxShiftDays, 10));

    ReschedulePlanResponse validated =
        agentPlanningToolService.validatePlan(
            new RescheduleValidateRequest(simulated.items()).items(), userId);

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
        startDate.equals(endDate)
            ? "재조정 제안 (" + startDate + ")"
            : "재조정 제안 (" + startDate + " ~ " + endDate + ")";

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
    LocalDate[] range = resolveDateRange(userMessage, List.of());
    LocalDate startDate = range[0];
    LocalDate endDate = range[1];
    LocalDate[] lookupRange = resolveTodoLookupRange(userId, userMessage, startDate, endDate);
    LocalDate contextStartDate = lookupRange[0];
    LocalDate contextEndDate = lookupRange[1];

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
      List<String> plannedCommands =
          planTodoEnhancementCommands(
              userMessage,
              calendarEvents.size(),
              existingTodos.size(),
              agentTodos.size(),
              contextStartDate,
              contextEndDate);
      Map<String, Object> enhancementResults =
          executeTodoEnhancementCommands(
              userId,
              userMessage,
              plannedCommands,
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
                  plannedCommands,
                  "enhancementResults",
                  enhancementResults));

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
                  + "- 기존 일정이 빡빡하면 estimateMinutes를 줄이거나 개수를 줄여 현실적으로 제안하라."));
      messages.add(new Message("user", userMessage));

      return openAiClient.createTodoJsonWithMessages(messages);
    } catch (Exception e) {
      throw new IllegalStateException("TODO 툴 루프 실행에 실패했습니다. " + e.getMessage());
    }
  }

  public List<String> buildTodoProgressNotes(Long userId, Long agentId, String userMessage) {
    LocalDate[] range = resolveDateRange(userMessage, List.of());
    LocalDate[] lookupRange = resolveTodoLookupRange(userId, userMessage, range[0], range[1]);
    String rangeLabel = formatRangeLabel(lookupRange[0], lookupRange[1]);
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem> calendarEvents =
        agentPlanningToolService.getCalendarEvents(userId, lookupRange[0], lookupRange[1]);
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> existingTodos =
        agentPlanningToolService.getTodos(userId, lookupRange[0], lookupRange[1], false);
    List<com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem> agentTodos =
        agentPlanningToolService.getTodosByAgent(
            userId, agentId, lookupRange[0], lookupRange[1], false);

    List<String> notes = new ArrayList<>();
    notes.add("요청에서 날짜 범위를 먼저 확인하고 있어요.");
    notes.add(rangeLabel + "의 고정 일정을 확인하고 있어요.");
    notes.add(rangeLabel + "의 기존 TODO를 확인하고 있어요.");
    notes.add("에이전트 담당 TODO의 연속성과 우선순위를 분석하고 있어요.");
    notes.add("사용자 시간 제약(dayStart/dayEnd)을 반영하고 있어요.");

    List<String> plannedCommands =
        planTodoEnhancementCommands(
            userMessage,
            calendarEvents.size(),
            existingTodos.size(),
            agentTodos.size(),
            lookupRange[0],
            lookupRange[1]);
    notes.addAll(mapCommandNotes(plannedCommands));
    notes.add("우선순위와 시간 충돌을 정리해서 추천안을 만들고 있어요.");
    return notes;
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
      String raw = openAiClient.createChatCompletionWithMessages(messages);
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
      log.info("🐰 [TODO_TOOL_LOOP] plannedCommands={}", commands);
      return commands;
    } catch (Exception e) {
      log.warn(
          "🐰 [TODO_TOOL_LOOP] command planning failed, fallback defaults. message={}",
          e.getMessage());
      return List.of("rank_task_priority", "detect_overload");
    }
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

      String rawPlan = openAiClient.createChatCompletionWithMessages(messages);
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
          "🐰 [CHAT_MODE_ROUTER] command={}, routedMode={}, confidence={}, reason={}",
          commandName,
          routedMode,
          confidence,
          reason);
      return routedMode;
    } catch (Exception e) {
      log.warn("🐰 [CHAT_MODE_ROUTER] failed, fallback CHAT. message={}", e.getMessage());
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
        "🐰 [TODO_LOOKUP_RANGE] begin userId={}, hasPreDayIntent={}, hasExamIntent={}, hasExplicitDateExpression={}, requestRange={}~{}",
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
            "🐰 [TODO_LOOKUP_RANGE] inferredExamDate={}, selectedRange={}~{}",
            inferredExamDate,
            today,
            inferredEnd);
        return new LocalDate[] {today, inferredEnd};
      }
      log.info("🐰 [TODO_LOOKUP_RANGE] inference returned null, fallback branch will be used.");
    }

    if ((hasPreDayIntent || hasExamIntent) && requestStartDate.isAfter(today)) {
      LocalDate rangeStart = today;
      LocalDate rangeEnd = requestStartDate.minusDays(1);
      if (rangeEnd.isBefore(rangeStart)) {
        rangeEnd = requestEndDate;
      }
      log.info("🐰 [TODO_LOOKUP_RANGE] intent fallback selectedRange={}~{}", rangeStart, rangeEnd);
      return new LocalDate[] {rangeStart, rangeEnd};
    }

    LocalDate defaultStart = requestStartDate.minusDays(3);
    LocalDate defaultEnd = requestEndDate.plusDays(3);
    log.info(
        "🐰 [TODO_LOOKUP_RANGE] default fallback selectedRange={}~{}", defaultStart, defaultEnd);
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
      log.info(
          "🐰 [TODO_LOOKUP_RANGE] examInference cache hit userId={}, date={}",
          userId,
          cached.examDate());
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

      String rawPlan = openAiClient.createChatCompletionWithMessages(messages);
      String planJson = extractJsonObject(rawPlan);
      if (planJson == null) return null;
      JsonNode root = objectMapper.readTree(planJson);
      JsonNode commands = root.path("commands");
      if (!commands.isArray() || commands.isEmpty()) return null;

      JsonNode command = commands.get(0);
      String name = command.path("name").asText("");
      if (!"select_exam_date".equals(name)) {
        String reason = command.path("reason").asText("");
        log.info(
            "🐰 [TODO_LOOKUP_RANGE] examInference no_selection commandName={}, reason={}",
            name,
            reason);
        return null;
      }
      LocalDate inferredDate = parseLocalDateSafe(command.path("targetDate").asText(null));
      if (inferredDate == null) {
        String reason = command.path("reason").asText("");
        log.info(
            "🐰 [TODO_LOOKUP_RANGE] examInference invalid_date targetDate={}, reason={}",
            command.path("targetDate").asText(""),
            reason);
        return null;
      }

      log.info(
          "🐰 [TODO_LOOKUP_RANGE] examInference aiCommand={}, inferredDate={}, events={}, todos={}",
          name,
          inferredDate,
          events.size(),
          todos.size());
      return inferredDate;
    } catch (Exception e) {
      log.warn("시험 일정 추론에 실패했습니다. message={}", e.getMessage());
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
}
