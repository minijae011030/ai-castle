package com.aicastle.backend.dto;

import com.aicastle.backend.entity.RecurringScheduleTemplate;
import java.time.LocalDate;
import java.time.LocalTime;

/** 정기 일정 템플릿용 DTO 모음. */
public class RecurringScheduleTemplateDtos {

  public record RecurringScheduleTemplateResponse(
      Long id,
      String title,
      String category,
      String description,
      LocalDate periodStartDate,
      LocalDate periodEndDate,
      String repeatWeekdays,
      LocalTime startTime,
      LocalTime endTime) {

    public static RecurringScheduleTemplateResponse fromEntity(RecurringScheduleTemplate entity) {
      return new RecurringScheduleTemplateResponse(
          entity.getId(),
          entity.getTitle(),
          entity.getCategory(),
          entity.getDescription(),
          entity.getPeriodStartDate(),
          entity.getPeriodEndDate(),
          entity.getRepeatWeekdays(),
          entity.getStartTime(),
          entity.getEndTime());
    }
  }

  public record RecurringScheduleTemplateCreateRequest(
      String title,
      String category,
      String description,
      LocalDate periodStartDate,
      LocalDate periodEndDate,
      String repeatWeekdays,
      LocalTime startTime,
      LocalTime endTime) {}
}
