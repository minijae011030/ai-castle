package com.aicastle.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;

/** 정기 일정 생성 요청. */
public record RecurringScheduleCreateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,
    @NotNull(message = "반복 시작일은 필수입니다.") LocalDate periodStart,
    @NotNull(message = "반복 종료일은 필수입니다.") LocalDate periodEnd,
    @NotBlank(message = "요일은 최소 1개 이상이어야 합니다.") @Size(max = 32, message = "요일 문자열이 너무 깁니다.")
        String weekdays,
    @NotNull(message = "시작 시간은 필수입니다.") LocalTime startTime,
    @NotNull(message = "종료 시간은 필수입니다.") LocalTime endTime,
    @Size(max = 5000) String memo) {}
