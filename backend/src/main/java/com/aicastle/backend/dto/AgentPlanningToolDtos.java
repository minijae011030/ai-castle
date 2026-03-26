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

  public record TimePreferenceRequest(String window, String intensity, Integer sleepDebtMinutes) {}

  public record TimePreferenceResponse(
      String recommendedWindow, String intensityAdjustment, String reason) {}

  public record EnergyCurveRequest(LocalDate startDate, LocalDate endDate) {}

  public record EnergyCurveItem(LocalDate date, String peakWindow, String lightWindow) {}

  public record EnergyCurveResponse(List<EnergyCurveItem> items) {}

  public record TaskEffortEstimateRequest(String taskText, String userLevel) {}

  public record TaskEffortEstimateResponse(Integer estimatedMinutes, String reason) {}

  public record SplitTaskRequest(
      String title,
      String description,
      Integer totalMinutes,
      Integer blockMinutes,
      String strategy) {}

  public record SplitTaskItem(String title, Integer minutes, String note) {}

  public record SplitTaskResponse(List<SplitTaskItem> items) {}

  public record PriorityRankItem(
      Long todoId, String title, String priority, Integer score, String reason) {}

  public record PriorityRankRequest(List<PriorityRankItem> items, String context) {}

  public record PriorityRankResponse(List<PriorityRankItem> rankedItems) {}

  public record OverloadDetectRequest(
      LocalDate startDate,
      LocalDate endDate,
      Integer maxDailyMinutes,
      Integer maxContinuousMinutes) {}

  public record OverloadDay(
      LocalDate date, Integer totalMinutes, boolean overloaded, String reason) {}

  public record OverloadDetectResponse(boolean overloaded, List<OverloadDay> days) {}

  public record BufferInsertRequest(
      List<ReschedulePlanItem> items, Integer bufferMinutes, String policy) {}

  public record BufferInsertResponse(List<ReschedulePlanItem> items) {}

  public record CommuteAwareRequest(
      List<ReschedulePlanItem> items, Integer commuteMinutes, String locationHint) {}

  public record CommuteAwareResponse(
      List<String> conflicts, List<ReschedulePlanItem> adjustedItems) {}

  public record DeadlineRiskRequest(String goalId, Integer horizonDays) {}

  public record DeadlineRiskResponse(
      String goalId, Integer riskScore, String riskLevel, String reason) {}

  public record NegotiationOption(String title, String summary, List<ReschedulePlanItem> items) {}

  public record NegotiationOptionsResponse(List<NegotiationOption> options) {}

  public record ApplySafeguardRequest(boolean dryRun, List<ReschedulePlanItem> items) {}

  public record ApplySafeguardResponse(
      boolean dryRun,
      Integer impactedCount,
      List<String> diffSummaries,
      List<ReschedulePlanItem> items) {}

  public record ExplainBriefRequest(String style, String text) {}
}
