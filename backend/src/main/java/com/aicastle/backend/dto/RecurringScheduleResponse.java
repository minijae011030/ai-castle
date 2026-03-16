package com.aicastle.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/** 정기 일정 한 건 응답. */
public record RecurringScheduleResponse(
    Long id,
    String title,
    LocalDate periodStart,
    LocalDate periodEnd,
    String weekdays,
    LocalTime startTime,
    LocalTime endTime,
    String memo) {}
