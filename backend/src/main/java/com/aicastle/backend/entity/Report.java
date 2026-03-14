package com.aicastle.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/** 서브에이전트가 제출하는 일일 리포트. Sliding Window(최근 N개)로 컨텍스트 관리. */
@Entity
@Table(
    name = "report",
    uniqueConstraints = {
      @UniqueConstraint(columnNames = {"user_account_id", "agent_role_id", "report_date"})
    })
public class Report extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "agent_role_id", nullable = false)
  private AgentRole agentRole;

  @Column(name = "report_date", nullable = false)
  private LocalDate reportDate;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String content;

  protected Report() {}

  public Report(
      UserAccount userAccount, AgentRole agentRole, LocalDate reportDate, String content) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.reportDate = reportDate;
    this.content = content;
  }

  public UserAccount getUserAccount() {
    return userAccount;
  }

  public AgentRole getAgentRole() {
    return agentRole;
  }

  public LocalDate getReportDate() {
    return reportDate;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }
}
