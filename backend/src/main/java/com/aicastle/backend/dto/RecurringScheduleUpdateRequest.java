package com.aicastle.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/** 정기 일정 수정 요청 (모든 필드 선택). */
public record RecurringScheduleUpdateRequest(
    String title,
    LocalDate periodStart,
    LocalDate periodEnd,
    String weekdays,
    LocalTime startTime,
    LocalTime endTime,
    String memo) {}
