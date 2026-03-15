package com.aicastle.backend.dto;

import java.time.LocalDateTime;

/** 캘린더 이벤트 응답. */
public record CalendarEventResponse(
    Long id,
    String title,
    LocalDateTime startAt,
    LocalDateTime endAt,
    String memo,
    LocalDateTime createdAt,
    LocalDateTime updatedAt) {}
