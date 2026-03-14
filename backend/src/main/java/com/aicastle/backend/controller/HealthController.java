package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 시스템 상태 확인용 헬스 체크 엔드포인트. */
@RestController
@RequestMapping("/api/health")
public class HealthController {

  @GetMapping
  @ResponseStatus(HttpStatus.OK)
  public ResultResponse<HealthPayload> health() {
    return ResultResponse.success(new HealthPayload("UP"));
  }

  public record HealthPayload(String status) {}
}
