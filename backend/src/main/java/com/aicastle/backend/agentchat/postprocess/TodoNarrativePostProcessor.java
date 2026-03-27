package com.aicastle.backend.agentchat.postprocess;

import com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class TodoNarrativePostProcessor {
  private final ObjectMapper objectMapper;

  public TodoNarrativePostProcessor(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String postProcessTodoNarrativeByEventContext(
      String rawTodoResponse, String userMessage, List<CalendarEventItem> calendarEvents) {
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

      CalendarEventItem matchedEvent =
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
      if (alignedText.equals(originalText) && !todoFieldsChanged && !timeAdjusted) {
        return rawTodoResponse;
      }

      ((ObjectNode) root).put("text", alignedText);
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
      return text.replaceAll("\\b" + mentionedHour + "\\s*시", normalizedActualHour + "시");
    }
    return text;
  }

  private boolean rewriteTodoFieldsByRelation(
      JsonNode todoNode, String eventLabel, RelationToEvent relation) {
    if (!(todoNode instanceof ArrayNode arrayNode)) return false;
    boolean changed = false;
    for (JsonNode item : arrayNode) {
      if (!(item instanceof ObjectNode objectNode)) continue;
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
      JsonNode firstTodoNode, CalendarEventItem matchedEvent, String userMessage) {
    String fallbackStartAtRaw = firstTodoNode.path("startAt").asText("");
    if (fallbackStartAtRaw.isBlank()) return matchedEvent.startAt();
    if (!(firstTodoNode instanceof ObjectNode firstTodoObjectNode)) {
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

  private CalendarEventItem findBestMatchedEvent(
      String userMessage,
      JsonNode firstTodoNode,
      LocalDateTime todoStartAt,
      List<CalendarEventItem> calendarEvents) {
    String normalizedMessage = normalizeText(userMessage);
    String todoTitle = normalizeText(firstTodoNode.path("title").asText(""));
    String todoDescription = normalizeText(firstTodoNode.path("description").asText(""));
    Set<String> messageTokens = tokenize(normalizedMessage);
    Set<String> todoTokens = tokenize(todoTitle + " " + todoDescription);

    int bestScore = Integer.MIN_VALUE;
    CalendarEventItem bestEvent = null;
    for (CalendarEventItem event : calendarEvents) {
      if (event == null || event.startAt() == null || event.endAt() == null) continue;
      String eventCategory = normalizeText(event.category());
      String eventTitle = normalizeText(event.title());
      String eventDescription = normalizeText(event.description());
      Set<String> eventTokens = tokenize(eventCategory + " " + eventTitle + " " + eventDescription);

      int score = 0;
      if (!eventCategory.isBlank() && normalizedMessage.contains(eventCategory)) score += 8;
      if (!eventCategory.isBlank() && (todoTitle + " " + todoDescription).contains(eventCategory)) {
        score += 5;
      }
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

  private String buildEventLabel(CalendarEventItem event) {
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
}
