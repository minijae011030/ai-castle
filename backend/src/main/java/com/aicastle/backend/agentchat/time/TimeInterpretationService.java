package com.aicastle.backend.agentchat.time;

import com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class TimeInterpretationService {
  private static final ZoneId PLANNER_ZONE_ID = ZoneId.of("Asia/Seoul");

  public String buildTimeInterpretationHint(
      String userMessage,
      List<CalendarEventItem> calendarEvents,
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
    CalendarEventItem bestMatchedEvent = null;
    int bestScore = Integer.MIN_VALUE;
    for (CalendarEventItem event : calendarEvents) {
      if (event == null || event.startAt() == null || event.endAt() == null) continue;
      LocalDate eventDate = event.date();
      if (eventDate == null) eventDate = event.startAt().toLocalDate();
      if (eventDate == null) continue;
      if (eventDate.isBefore(contextStartDate) || eventDate.isAfter(contextEndDate)) continue;

      String category = normalizeText(event.category());
      String title = normalizeText(event.title());
      String description = normalizeText(event.description());
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
    String category = normalizeText(bestMatchedEvent.category());
    String title = normalizeText(bestMatchedEvent.title());
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

  private int overlapScore(Set<String> leftTokens, Set<String> rightTokens, int perToken) {
    if (leftTokens.isEmpty() || rightTokens.isEmpty()) return 0;
    int overlap = 0;
    for (String token : leftTokens) {
      if (rightTokens.contains(token)) overlap++;
    }
    return overlap * perToken;
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
}
