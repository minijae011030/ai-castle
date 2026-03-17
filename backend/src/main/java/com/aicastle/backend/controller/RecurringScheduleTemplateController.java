package com.aicastle.backend.controller;

import com.aicastle.backend.dto.RecurringScheduleTemplateDtos.RecurringScheduleTemplateCreateRequest;
import com.aicastle.backend.dto.RecurringScheduleTemplateDtos.RecurringScheduleTemplateResponse;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.RecurringScheduleTemplateService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 정기 일정 템플릿 조회/생성 API. */
@RestController
@RequestMapping("/api/calendar/recurring-templates")
public class RecurringScheduleTemplateController {

  private final RecurringScheduleTemplateService recurringScheduleTemplateService;

  public RecurringScheduleTemplateController(
      RecurringScheduleTemplateService recurringScheduleTemplateService) {
    this.recurringScheduleTemplateService = recurringScheduleTemplateService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<RecurringScheduleTemplateResponse>>> list() {
    Long userId = getUserId();
    List<RecurringScheduleTemplateResponse> data =
        recurringScheduleTemplateService.findAllByUserId(userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<RecurringScheduleTemplateResponse>> create(
      @RequestBody RecurringScheduleTemplateCreateRequest request) {
    Long userId = getUserId();
    RecurringScheduleTemplateResponse data =
        recurringScheduleTemplateService.create(userId, request);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ResultResponse.success("정기 일정 템플릿이 생성되었습니다.", data));
  }
}
