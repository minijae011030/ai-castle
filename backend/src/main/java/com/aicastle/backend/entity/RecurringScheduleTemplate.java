package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import lombok.Getter;
import lombok.Setter;

/** 정기 일정 템플릿 (반복 규칙 정의용). */
@Getter
@Setter
@Entity
@Table(name = "recurring_schedule_template")
public class RecurringScheduleTemplate extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String description;

  /** 반복 적용 시작일 (포함). */
  @Column(name = "period_start", nullable = false)
  private LocalDate periodStartDate;

  /** 반복 적용 종료일 (포함). */
  @Column(name = "period_end", nullable = false)
  private LocalDate periodEndDate;

  /**
   * 반복 요일: "MON,TUE,WED" 처럼 쉼표로 구분된 요일 코드.
   *
   * <p>프론트에서는 ['MON','TUE'] 배열로 관리하고, 백엔드에서는 문자열로 보관한다.
   */
  @Column(name = "weekdays", nullable = false, length = 32)
  private String repeatWeekdays;

  /** 하루 중 시작 시각. */
  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  /** 하루 중 종료 시각. */
  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  protected RecurringScheduleTemplate() {}

  public RecurringScheduleTemplate(
      UserAccount userAccount,
      String title,
      String description,
      LocalDate periodStartDate,
      LocalDate periodEndDate,
      String repeatWeekdays,
      LocalTime startTime,
      LocalTime endTime) {
    this.userAccount = userAccount;
    this.title = title;
    this.description = description;
    this.periodStartDate = periodStartDate;
    this.periodEndDate = periodEndDate;
    this.repeatWeekdays = repeatWeekdays;
    this.startTime = startTime;
    this.endTime = endTime;
  }
}
