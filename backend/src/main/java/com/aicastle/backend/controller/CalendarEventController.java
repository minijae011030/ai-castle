package com.aicastle.backend.controller;

import com.aicastle.backend.dto.CalendarEventCreateRequest;
import com.aicastle.backend.dto.CalendarEventResponse;
import com.aicastle.backend.dto.CalendarEventUpdateRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.CalendarEventService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 캘린더 이벤트 CRUD API. 인증 후 userId는 SecurityContext principal. */
@RestController
@RequestMapping("/api/calendar/events")
public class CalendarEventController {

  private final CalendarEventService calendarEventService;

  public CalendarEventController(CalendarEventService calendarEventService) {
    this.calendarEventService = calendarEventService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<CalendarEventResponse>>> list() {
    Long userId = getUserId();
    List<CalendarEventResponse> data = calendarEventService.findAllByUserId(userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ResultResponse<CalendarEventResponse>> get(@PathVariable Long id) {
    Long userId = getUserId();
    CalendarEventResponse data = calendarEventService.findByIdAndUserId(id, userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<CalendarEventResponse>> create(
      @Valid @RequestBody CalendarEventCreateRequest body) {
    Long userId = getUserId();
    CalendarEventResponse data = calendarEventService.create(userId, body);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ResultResponse.success("이벤트가 등록되었습니다.", data));
  }

  @PatchMapping("/{id}")
  public ResponseEntity<ResultResponse<CalendarEventResponse>> update(
      @PathVariable Long id, @Valid @RequestBody CalendarEventUpdateRequest body) {
    Long userId = getUserId();
    CalendarEventResponse data = calendarEventService.update(id, userId, body);
    return ResponseEntity.ok(ResultResponse.success("이벤트가 수정되었습니다.", data));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ResultResponse<Void>> delete(@PathVariable Long id) {
    Long userId = getUserId();
    calendarEventService.delete(id, userId);
    return ResponseEntity.ok(ResultResponse.success("이벤트가 삭제되었습니다.", null));
  }
}
