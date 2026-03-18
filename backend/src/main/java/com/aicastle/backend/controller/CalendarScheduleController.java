package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleCreateRequest;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleOccurrenceResponse;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleRangeCreateRequest;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleUpdateRequest;
import com.aicastle.backend.service.CalendarScheduleService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 캘린더 스케줄(정기일정/일정/할일 인스턴스) 조회/조작 API. */
@RestController
@RequestMapping("/api/calendar/schedules")
public class CalendarScheduleController {

  private final CalendarScheduleService calendarScheduleService;

  public CalendarScheduleController(CalendarScheduleService calendarScheduleService) {
    this.calendarScheduleService = calendarScheduleService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  /** 특정 날짜 기준 스케줄 조회. */
  @GetMapping("/day")
  public ResponseEntity<ResultResponse<List<ScheduleOccurrenceResponse>>> getByDay(
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    Long userId = getUserId();
    List<ScheduleOccurrenceResponse> data = calendarScheduleService.getSchedulesByDay(userId, date);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  /** 특정 월 기준 스케줄 조회. */
  @GetMapping("/month")
  public ResponseEntity<ResultResponse<List<ScheduleOccurrenceResponse>>> getByMonth(
      @RequestParam("year") int year, @RequestParam("month") int month) {
    Long userId = getUserId();
    List<ScheduleOccurrenceResponse> data =
        calendarScheduleService.getSchedulesByMonth(userId, year, month);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  /** 단일 스케줄 생성. type 기반으로 정기일정/일정/할일 구분. */
  @PostMapping
  public ResponseEntity<ResultResponse<ScheduleOccurrenceResponse>> create(
      @RequestBody ScheduleCreateRequest request) {
    Long userId = getUserId();
    ScheduleOccurrenceResponse data = calendarScheduleService.create(userId, request);
    return ResponseEntity.ok(ResultResponse.success("스케줄이 생성되었습니다.", data));
  }

  /** 기간 범위 스케줄 생성 (일정/할일). */
  @PostMapping("/range")
  public ResponseEntity<ResultResponse<List<ScheduleOccurrenceResponse>>> createRange(
      @RequestBody ScheduleRangeCreateRequest request) {
    Long userId = getUserId();
    List<ScheduleOccurrenceResponse> data = calendarScheduleService.createRange(userId, request);
    return ResponseEntity.ok(ResultResponse.success("스케줄이 생성되었습니다.", data));
  }

  /** 단일 스케줄 부분 수정. */
  @PatchMapping("/{id}")
  public ResponseEntity<ResultResponse<ScheduleOccurrenceResponse>> update(
      @PathVariable Long id, @RequestBody ScheduleUpdateRequest request) {
    Long userId = getUserId();
    ScheduleOccurrenceResponse data = calendarScheduleService.update(userId, id, request);
    return ResponseEntity.ok(ResultResponse.success("스케줄이 수정되었습니다.", data));
  }

  /** 완료/완료 취소 토글. */
  @PatchMapping("/{id}/toggle-done")
  public ResponseEntity<ResultResponse<ScheduleOccurrenceResponse>> toggleDone(
      @PathVariable Long id) {
    Long userId = getUserId();
    ScheduleOccurrenceResponse data = calendarScheduleService.toggleDone(userId, id);
    return ResponseEntity.ok(ResultResponse.success("스케줄 완료 상태가 변경되었습니다.", data));
  }

  /** 정기 일정 템플릿 기반 occurrence 완료/완료 취소 토글. */
  public record RecurringToggleRequest(
      Long templateId, @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {}

  @PatchMapping("/recurring/toggle-done")
  public ResponseEntity<ResultResponse<ScheduleOccurrenceResponse>> toggleRecurringDone(
      @RequestBody RecurringToggleRequest request) {
    Long userId = getUserId();
    ScheduleOccurrenceResponse data =
        calendarScheduleService.toggleRecurringTemplateOccurrence(
            userId, request.templateId(), request.date());
    return ResponseEntity.ok(ResultResponse.success("정기 일정 완료 상태가 변경되었습니다.", data));
  }

  /** 단일 스케줄 삭제. */
  @DeleteMapping("/{id}")
  public ResponseEntity<ResultResponse<Void>> delete(@PathVariable Long id) {
    Long userId = getUserId();
    calendarScheduleService.delete(userId, id);
    return ResponseEntity.ok(ResultResponse.success("스케줄이 삭제되었습니다.", null));
  }
}
