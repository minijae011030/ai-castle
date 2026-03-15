package com.aicastle.backend.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** 캘린더 이벤트 수정 요청. null이면 해당 필드는 변경하지 않음. */
public record CalendarEventUpdateRequest(
    @Size(max = 200) String title,
    LocalDateTime startAt,
    LocalDateTime endAt,
    @Size(max = 5000) String memo) {}
