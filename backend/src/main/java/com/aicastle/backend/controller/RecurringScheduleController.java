package com.aicastle.backend.controller;

import com.aicastle.backend.dto.RecurringScheduleCreateRequest;
import com.aicastle.backend.dto.RecurringScheduleResponse;
import com.aicastle.backend.dto.RecurringScheduleUpdateRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.RecurringScheduleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 정기 일정(반복 스케줄) CRUD API. 인증 후 userId는 SecurityContext principal. */
@RestController
@RequestMapping("/api/calendar/recurring-schedules")
public class RecurringScheduleController {

  private final RecurringScheduleService recurringScheduleService;

  public RecurringScheduleController(RecurringScheduleService recurringScheduleService) {
    this.recurringScheduleService = recurringScheduleService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<RecurringScheduleResponse>>> list() {
    Long userId = getUserId();
    List<RecurringScheduleResponse> data = recurringScheduleService.findAllByUserId(userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<RecurringScheduleResponse>> create(
      @Valid @RequestBody RecurringScheduleCreateRequest body) {
    Long userId = getUserId();
    RecurringScheduleResponse data = recurringScheduleService.create(userId, body);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ResultResponse.success("정기 일정이 등록되었습니다.", data));
  }

  @PatchMapping("/{id}")
  public ResponseEntity<ResultResponse<RecurringScheduleResponse>> update(
      @PathVariable Long id, @Valid @RequestBody RecurringScheduleUpdateRequest body) {
    Long userId = getUserId();
    RecurringScheduleResponse data = recurringScheduleService.update(id, userId, body);
    return ResponseEntity.ok(ResultResponse.success("정기 일정이 수정되었습니다.", data));
  }
}
