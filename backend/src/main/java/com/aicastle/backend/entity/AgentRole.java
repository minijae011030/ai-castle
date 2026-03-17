package com.aicastle.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** 에이전트 역할. 동적 프롬프팅용 시스템 프롬프트 저장. */
@Getter
@Setter
@Entity
@Table(name = "agent_role")
public class AgentRole extends BaseTimeEntity {

  @Column(nullable = false, unique = true, length = 50)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "role_type", nullable = false, length = 20)
  private AgentRoleType roleType;

  @Column(name = "system_prompt", nullable = false, columnDefinition = "TEXT")
  private String systemPrompt;

  protected AgentRole() {}

  public AgentRole(String name, AgentRoleType roleType, String systemPrompt) {
    this.name = name;
    this.roleType = roleType;
    this.systemPrompt = systemPrompt;
  }
}
