package com.aicastle.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 에이전트별 고정 메모리(최대 10개). 사용자가 직접 추가/삭제한다. */
@Getter
@Setter
@Entity
@Table(name = "agent_pinned_memory")
public class AgentPinnedMemory extends BaseTimeEntity {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "agent_role_id", nullable = false)
  private AgentRole agentRole;

  @Column(name = "content", nullable = false, length = 2000)
  private String content;

  protected AgentPinnedMemory() {}

  public AgentPinnedMemory(UserAccount userAccount, AgentRole agentRole, String content) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.content = content;
  }
}
