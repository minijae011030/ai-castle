package com.aicastle.backend.controller;

import com.aicastle.backend.dto.AgentPlanningToolDtos.*;
import com.aicastle.backend.dto.AgentPlanningToolDtos.DateRangeRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleApplyRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleApplyResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleExplainRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ReschedulePlanResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleRollbackRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleRollbackResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleSimulateRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleValidateRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.AgentPlanningToolService;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 에이전트 계획/재조정 자동화를 위한 툴셋 API. */
@RestController
@RequestMapping("/api/agent-tools")
public class AgentPlanningToolController {

  private final AgentPlanningToolService agentPlanningToolService;

  public AgentPlanningToolController(AgentPlanningToolService agentPlanningToolService) {
    this.agentPlanningToolService = agentPlanningToolService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping("/calendar-events")
  public ResponseEntity<ResultResponse<?>> getCalendarEvents(
      @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
      @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
    Long userId = getUserId();
    DateRangeRequest request = new DateRangeRequest(startDate, endDate);
    return ResponseEntity.ok(
        ResultResponse.success(
            agentPlanningToolService.getCalendarEvents(
                userId, request.startDate(), request.endDate())));
  }

  @GetMapping("/todos")
  public ResponseEntity<ResultResponse<?>> getTodos(
      @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
      @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
      @RequestParam(value = "done", required = false) Boolean done) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(
            agentPlanningToolService.getTodos(userId, startDate, endDate, done)));
  }

  @GetMapping("/user-constraints")
  public ResponseEntity<ResultResponse<?>> getUserConstraints() {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.getUserConstraints(userId)));
  }

  @PostMapping("/reschedule/simulate")
  public ResponseEntity<ResultResponse<ReschedulePlanResponse>> simulateReschedule(
      @RequestBody RescheduleSimulateRequest request) {
    Long userId = getUserId();
    ReschedulePlanResponse data = agentPlanningToolService.simulateReschedule(userId, request);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping("/reschedule/validate")
  public ResponseEntity<ResultResponse<ReschedulePlanResponse>> validateReschedule(
      @RequestBody RescheduleValidateRequest request) {
    Long userId = getUserId();
    ReschedulePlanResponse data = agentPlanningToolService.validatePlan(request.items(), userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping("/reschedule/apply")
  public ResponseEntity<ResultResponse<RescheduleApplyResponse>> applyReschedule(
      @RequestBody RescheduleApplyRequest request) {
    Long userId = getUserId();
    RescheduleApplyResponse data = agentPlanningToolService.applyPlan(userId, request);
    return ResponseEntity.ok(ResultResponse.success("재조정 계획이 처리되었습니다.", data));
  }

  @PostMapping("/reschedule/rollback")
  public ResponseEntity<ResultResponse<RescheduleRollbackResponse>> rollbackReschedule(
      @RequestBody RescheduleRollbackRequest request) {
    Long userId = getUserId();
    RescheduleRollbackResponse data = agentPlanningToolService.rollback(userId, request);
    return ResponseEntity.ok(ResultResponse.success("재조정 롤백이 완료되었습니다.", data));
  }

  @PostMapping("/reschedule/explain")
  public ResponseEntity<ResultResponse<String>> explainReschedule(
      @RequestBody RescheduleExplainRequest request) {
    String data = agentPlanningToolService.explainPlan(request);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping("/time-preference")
  public ResponseEntity<ResultResponse<TimePreferenceResponse>> resolveTimePreference(
      @RequestBody TimePreferenceRequest request) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.resolveTimePreference(userId, request)));
  }

  @PostMapping("/energy-curve")
  public ResponseEntity<ResultResponse<EnergyCurveResponse>> getEnergyCurve(
      @RequestBody EnergyCurveRequest request) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.getEnergyCurve(userId, request)));
  }

  @PostMapping("/task-effort")
  public ResponseEntity<ResultResponse<TaskEffortEstimateResponse>> estimateTaskEffort(
      @RequestBody TaskEffortEstimateRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.estimateTaskEffort(request)));
  }

  @PostMapping("/split-task")
  public ResponseEntity<ResultResponse<SplitTaskResponse>> splitTask(
      @RequestBody SplitTaskRequest request) {
    return ResponseEntity.ok(ResultResponse.success(agentPlanningToolService.splitTask(request)));
  }

  @PostMapping("/rank-priority")
  public ResponseEntity<ResultResponse<PriorityRankResponse>> rankTaskPriority(
      @RequestBody PriorityRankRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.rankTaskPriority(request)));
  }

  @PostMapping("/detect-overload")
  public ResponseEntity<ResultResponse<OverloadDetectResponse>> detectOverload(
      @RequestBody OverloadDetectRequest request) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.detectOverload(userId, request)));
  }

  @PostMapping("/insert-buffer")
  public ResponseEntity<ResultResponse<BufferInsertResponse>> insertBuffer(
      @RequestBody BufferInsertRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.insertBufferBlocks(request)));
  }

  @PostMapping("/commute-aware")
  public ResponseEntity<ResultResponse<CommuteAwareResponse>> commuteAware(
      @RequestBody CommuteAwareRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.commuteAwareSchedule(request)));
  }

  @PostMapping("/deadline-risk")
  public ResponseEntity<ResultResponse<DeadlineRiskResponse>> deadlineRisk(
      @RequestBody DeadlineRiskRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.getDeadlineRiskScore(request)));
  }

  @PostMapping("/negotiation-options")
  public ResponseEntity<ResultResponse<NegotiationOptionsResponse>> negotiationOptions(
      @RequestBody RescheduleValidateRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(
            agentPlanningToolService.suggestNegotiationOptions(request.items())));
  }

  @PostMapping("/apply-with-safeguard")
  public ResponseEntity<ResultResponse<ApplySafeguardResponse>> applyWithSafeguard(
      @RequestBody ApplySafeguardRequest request) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.applyWithSafeguard(userId, request)));
  }

  @PostMapping("/explain-brief")
  public ResponseEntity<ResultResponse<String>> explainBrief(
      @RequestBody ExplainBriefRequest request) {
    return ResponseEntity.ok(
        ResultResponse.success(agentPlanningToolService.explainPlanBrief(request)));
  }
}
