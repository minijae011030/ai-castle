package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalTime;

/** 사용자(예서) 계정. biorhythm(day_start_time, day_end_time)으로 스케줄 배치 트리거. */
@Entity
@Table(name = "user_account")
public class UserAccount extends BaseTimeEntity {

  @Column(nullable = false, unique = true, length = 255)
  private String email;

  @Column(name = "user_name", nullable = false, length = 100)
  private String userName;

  @Column(name = "password_hash", nullable = false, length = 255)
  private String passwordHash;

  /** 일과 시작 시간 (기상). 이 시각에 Start Batch 트리거. */
  @Column(name = "day_start_time", nullable = false)
  private LocalTime dayStartTime;

  /** 일과 종료 시간 (취침). 이 시각에 End Batch 트리거. */
  @Column(name = "day_end_time", nullable = false)
  private LocalTime dayEndTime;

  protected UserAccount() {}

  public UserAccount(
      String email,
      String userName,
      String passwordHash,
      LocalTime dayStartTime,
      LocalTime dayEndTime) {
    this.email = email;
    this.userName = userName;
    this.passwordHash = passwordHash;
    this.dayStartTime = dayStartTime;
    this.dayEndTime = dayEndTime;
  }

  public String getEmail() {
    return email;
  }

  public String getUserName() {
    return userName;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public LocalTime getDayStartTime() {
    return dayStartTime;
  }

  public LocalTime getDayEndTime() {
    return dayEndTime;
  }

  public void setUserName(String userName) {
    this.userName = userName;
  }

  public void setDayStartTime(LocalTime dayStartTime) {
    this.dayStartTime = dayStartTime;
  }

  public void setDayEndTime(LocalTime dayEndTime) {
    this.dayEndTime = dayEndTime;
  }
}
