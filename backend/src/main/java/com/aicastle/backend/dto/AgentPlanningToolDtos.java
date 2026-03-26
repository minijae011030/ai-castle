package com.aicastle.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/** 에이전트 계획/재조정 툴셋 DTO 모음. */
public class AgentPlanningToolDtos {

  public enum ApplyMode {
    DRAFT,
    COMMIT
  }

  public record DateRangeRequest(LocalDate startDate, LocalDate endDate) {}

  public record CalendarEventItem(
      Long id,
      String title,
      String description,
      LocalDate date,
      LocalDateTime startAt,
      LocalDateTime endAt) {}

  public record TodoItem(
      Long id,
      String title,
      String description,
      boolean done,
      LocalDate date,
      LocalDateTime startAt,
      LocalDateTime endAt,
      Long agentId,
      String groupId,
      String groupTitle) {}

  public record UserConstraintResponse(
      LocalTime dayStartTime,
      LocalTime dayEndTime,
      Integer age,
      String interests,
      String intensity) {}

  public record RescheduleSimulateRequest(
      LocalDate startDate,
      LocalDate endDate,
      List<Long> todoIds,
      Integer maxShiftDays,
      Integer minBufferMinutes) {}

  public record ReschedulePlanItem(
      Long todoId,
      String title,
      LocalDateTime originalStartAt,
      LocalDateTime originalEndAt,
      LocalDateTime proposedStartAt,
      LocalDateTime proposedEndAt,
      String status,
      String reason) {}

  public record ReschedulePlanResponse(
      String planId, boolean feasible, List<String> conflicts, List<ReschedulePlanItem> items) {}

  public record RescheduleValidateRequest(List<ReschedulePlanItem> items) {}

  public record RescheduleApplyRequest(ApplyMode mode, List<ReschedulePlanItem> items) {}

  public record RescheduleApplyResponse(
      String changeSetId,
      ApplyMode mode,
      int appliedCount,
      List<ReschedulePlanItem> appliedItems) {}

  public record RescheduleRollbackRequest(List<ReschedulePlanItem> appliedItems) {}

  public record RescheduleRollbackResponse(String rollbackId, int rollbackCount) {}

  public record RescheduleExplainRequest(
      String userMessage, List<ReschedulePlanItem> items, List<String> conflicts) {}
}
