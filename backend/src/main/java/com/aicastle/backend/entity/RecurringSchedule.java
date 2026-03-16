package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;

/** 정기 일정(반복 스케줄) 정의. 캘린더 뷰 및 배치 스케줄링의 기반. */
@Entity
@Table(name = "recurring_schedule")
public class RecurringSchedule extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @Column(nullable = false, length = 200)
  private String title;

  /** 반복 적용 시작일 (포함). */
  @Column(name = "period_start", nullable = false)
  private LocalDate periodStart;

  /** 반복 적용 종료일 (포함). */
  @Column(name = "period_end", nullable = false)
  private LocalDate periodEnd;

  /**
   * 반복 요일: "MON,TUE,WED" 처럼 쉼표로 구분된 요일 코드.
   *
   * <p>프론트에서는 월~일 토글을 camelCase enum으로 관리하고, 백엔드에서는 문자열로 보관한다.
   */
  @Column(name = "weekdays", nullable = false, length = 32)
  private String weekdays;

  /** 하루 중 시작 시각. */
  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  /** 하루 중 종료 시각. */
  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(columnDefinition = "TEXT")
  private String memo;

  protected RecurringSchedule() {}

  public RecurringSchedule(
      UserAccount userAccount,
      String title,
      LocalDate periodStart,
      LocalDate periodEnd,
      String weekdays,
      LocalTime startTime,
      LocalTime endTime,
      String memo) {
    this.userAccount = userAccount;
    this.title = title;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.weekdays = weekdays;
    this.startTime = startTime;
    this.endTime = endTime;
    this.memo = memo;
  }

  public Long getId() {
    return super.getId();
  }

  public UserAccount getUserAccount() {
    return userAccount;
  }

  public String getTitle() {
    return title;
  }

  public LocalDate getPeriodStart() {
    return periodStart;
  }

  public LocalDate getPeriodEnd() {
    return periodEnd;
  }

  public String getWeekdays() {
    return weekdays;
  }

  public LocalTime getStartTime() {
    return startTime;
  }

  public LocalTime getEndTime() {
    return endTime;
  }

  public String getMemo() {
    return memo;
  }
}
