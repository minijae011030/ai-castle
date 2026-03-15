package com.aicastle.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** 캘린더 이벤트 생성 요청. */
public record CalendarEventCreateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,
    @NotNull(message = "시작 시각은 필수입니다.") LocalDateTime startAt,
    @NotNull(message = "종료 시각은 필수입니다.") LocalDateTime endAt,
    @Size(max = 5000) String memo) {}
