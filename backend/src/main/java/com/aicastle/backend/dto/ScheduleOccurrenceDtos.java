package com.aicastle.backend.dto;

import com.aicastle.backend.entity.ScheduleOccurrence;
import com.aicastle.backend.entity.ScheduleOccurrence.ScheduleType;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** ScheduleOccurrence 도메인용 DTO 모음. */
public class ScheduleOccurrenceDtos {

  /** 조회용 응답 DTO (문서의 ScheduleEntity 에 대응). */
  public record ScheduleOccurrenceResponse(
      Long id,
      String title,
      String description,
      boolean done,
      ScheduleType type,
      LocalDate occurrenceDate,
      LocalDateTime startAt,
      LocalDateTime endAt,
      Long recurringTemplateId,
      Long calendarEventId,
      Long todoId) {

    public static ScheduleOccurrenceResponse fromEntity(ScheduleOccurrence entity) {
      return new ScheduleOccurrenceResponse(
          entity.getId(),
          entity.getTitle(),
          entity.getDescription(),
          entity.isDone(),
          entity.getType(),
          entity.getOccurrenceDate(),
          entity.getStartAt(),
          entity.getEndAt(),
          entity.getRecurringTemplateId(),
          entity.getCalendarEventId(),
          entity.getTodoId());
    }
  }

  /** 단일 스케줄 생성 요청 DTO (type 기반 분기). */
  public record ScheduleCreateRequest(
      ScheduleType type,
      String title,
      String description,
      LocalDate occurrenceDate,
      LocalDateTime startAt,
      LocalDateTime endAt,
      Long recurringTemplateId,
      Long calendarEventId,
      Long todoId) {}

  /** 부분 수정 요청 DTO. */
  public record ScheduleUpdateRequest(
      String title, String description, Boolean done, LocalDateTime startAt, LocalDateTime endAt) {}
}
