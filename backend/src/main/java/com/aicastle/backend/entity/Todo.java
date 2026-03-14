package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/** 일일 할일. 메인 에이전트가 서브에이전트에게 위임 후 생성. 협상 시 날짜/상태 변경. */
@Entity
@Table(name = "todo")
public class Todo extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "agent_role_id", nullable = false)
  private AgentRole agentRole;

  @Column(nullable = false, length = 300)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private TodoStatus status = TodoStatus.PENDING;

  @Column(name = "scheduled_date", nullable = false)
  private LocalDate scheduledDate;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  protected Todo() {}

  public Todo(
      UserAccount userAccount,
      AgentRole agentRole,
      String title,
      String description,
      LocalDate scheduledDate,
      int orderIndex) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.title = title;
    this.description = description;
    this.scheduledDate = scheduledDate;
    this.orderIndex = orderIndex;
  }

  public UserAccount getUserAccount() {
    return userAccount;
  }

  public AgentRole getAgentRole() {
    return agentRole;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
  }

  public TodoStatus getStatus() {
    return status;
  }

  public LocalDate getScheduledDate() {
    return scheduledDate;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public void setStatus(TodoStatus status) {
    this.status = status;
  }

  public void setScheduledDate(LocalDate scheduledDate) {
    this.scheduledDate = scheduledDate;
  }

  public void setOrderIndex(int orderIndex) {
    this.orderIndex = orderIndex;
  }
}
