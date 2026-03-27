package com.aicastle.backend.agentchat.policy;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class EnhancementCommandPolicy {

  public boolean shouldSkipTodoEnhancementPlanning(
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

  public int resolveEnhancementCommandLimit(
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

  public List<String> sanitizePlannedCommands(List<String> plannedCommands, int maxCommands) {
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
}
