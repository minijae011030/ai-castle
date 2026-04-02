package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.ReportService;
import com.aicastle.backend.service.ReportService.ReportResponse;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

  private final ReportService reportService;

  public ReportController(ReportService reportService) {
    this.reportService = reportService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  /** 특정 날짜의 모든 리포트 목록. */
  @GetMapping
  public ResponseEntity<ResultResponse<List<ReportResponse>>> getByDate(
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    Long userId = getUserId();
    return ResponseEntity.ok(ResultResponse.success(reportService.getReportsByDate(userId, date)));
  }

  /** 특정 에이전트의 최근 N개 리포트 (Sliding Window). */
  @GetMapping("/recent")
  public ResponseEntity<ResultResponse<List<ReportResponse>>> getRecent(
      @RequestParam Long agentId, @RequestParam(defaultValue = "7") int limit) {
    Long userId = getUserId();
    return ResponseEntity.ok(
        ResultResponse.success(reportService.getRecentReports(userId, agentId, limit)));
  }
}
