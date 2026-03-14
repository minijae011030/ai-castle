package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** 사용자 캘린더 이벤트. HITL - 절대 기준. 스케줄링 시 프롬프트에 최우선 주입. */
@Entity
@Table(name = "calendar_event")
public class CalendarEvent extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(name = "start_at", nullable = false)
  private LocalDateTime startAt;

  @Column(name = "end_at", nullable = false)
  private LocalDateTime endAt;

  @Column(columnDefinition = "TEXT")
  private String memo;

  protected CalendarEvent() {}

  public CalendarEvent(
      UserAccount userAccount,
      String title,
      LocalDateTime startAt,
      LocalDateTime endAt,
      String memo) {
    this.userAccount = userAccount;
    this.title = title;
    this.startAt = startAt;
    this.endAt = endAt;
    this.memo = memo;
  }

  public UserAccount getUserAccount() {
    return userAccount;
  }

  public String getTitle() {
    return title;
  }

  public LocalDateTime getStartAt() {
    return startAt;
  }

  public LocalDateTime getEndAt() {
    return endAt;
  }

  public String getMemo() {
    return memo;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public void setStartAt(LocalDateTime startAt) {
    this.startAt = startAt;
  }

  public void setEndAt(LocalDateTime endAt) {
    this.endAt = endAt;
  }

  public void setMemo(String memo) {
    this.memo = memo;
  }
}
