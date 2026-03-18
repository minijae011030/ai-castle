package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * 날짜별 스케줄 인스턴스 엔티티.
 *
 * <p>정기일정 템플릿 / 단일 일정 / Todo 를 모두 이 인스턴스로 풀어서 관리한다.
 */
@Getter
@Setter
@Entity
@Table(name = "schedule_occurrence")
public class ScheduleOccurrence extends BaseTimeEntity {

  public enum ScheduleType {
    RECURRING_OCCURRENCE,
    CALENDAR_EVENT,
    TODO
  }

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @Enumerated(EnumType.STRING)
  @Column(name = "type", nullable = false, length = 32)
  private ScheduleType type;

  /** 정기일정 템플릿 ID (없으면 null). FK 제약은 이후 실제 템플릿 엔티티 추가 시 연결. */
  @Column(name = "recurring_template_id")
  private Long recurringTemplateId;

  /** TODO에 연결되는 에이전트 ID (없으면 null). */
  @Column(name = "agent_id")
  private Long agentId;

  // 공통 표출 필드 (스냅샷)
  @Column(nullable = false, length = 200)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String description;

  @Column(name = "occurrence_date", nullable = false)
  private LocalDate occurrenceDate;

  @Column(name = "start_at", nullable = false)
  private LocalDateTime startAt;

  @Column(name = "end_at", nullable = false)
  private LocalDateTime endAt;

  @Column(name = "done", nullable = false)
  private boolean done = false;

  protected ScheduleOccurrence() {}

  public ScheduleOccurrence(
      UserAccount userAccount,
      ScheduleType type,
      String title,
      String description,
      LocalDate occurrenceDate,
      LocalDateTime startAt,
      LocalDateTime endAt) {
    this.userAccount = userAccount;
    this.type = type;
    this.title = title;
    this.description = description;
    this.occurrenceDate = occurrenceDate;
    this.startAt = startAt;
    this.endAt = endAt;
  }
}
