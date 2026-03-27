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
      String category,
      String description,
      boolean done,
      ScheduleType type,
      LocalDate occurrenceDate,
      LocalDateTime startAt,
      LocalDateTime endAt,
      Long recurringTemplateId,
      Long agentId,
      String groupId,
      String groupTitle) {

    public static ScheduleOccurrenceResponse fromEntity(ScheduleOccurrence entity) {
      return new ScheduleOccurrenceResponse(
          entity.getId(),
          entity.getTitle(),
          entity.getCategory(),
          entity.getDescription(),
          entity.isDone(),
          entity.getType(),
          entity.getOccurrenceDate(),
          entity.getStartAt(),
          entity.getEndAt(),
          entity.getRecurringTemplateId(),
          entity.getAgentId(),
          entity.getGroupId(),
          entity.getGroupTitle());
    }
  }

  /** 단일 스케줄 생성 요청 DTO (type 기반 분기). */
  public record ScheduleCreateRequest(
      ScheduleType type,
      String title,
      String category,
      String description,
      LocalDate occurrenceDate,
      LocalDateTime startAt,
      LocalDateTime endAt,
      Long recurringTemplateId,
      Long agentId,
      String groupId,
      String groupTitle) {}

  /** 기간 범위 스케줄 생성 요청 DTO (일정/할일용). */
  public record ScheduleRangeCreateRequest(
      ScheduleType type,
      String title,
      String category,
      String description,
      LocalDate startDate,
      LocalDate endDate,
      java.time.LocalTime startTime,
      java.time.LocalTime endTime,
      Long agentId,
      String groupId,
      String groupTitle) {}

  /** 부분 수정 요청 DTO. */
  public record ScheduleUpdateRequest(
      String title,
      String category,
      String description,
      Boolean done,
      LocalDateTime startAt,
      LocalDateTime endAt) {}
}
