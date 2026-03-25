package com.aicastle.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Check;

/** 에이전트 역할. 동적 프롬프팅용 시스템 프롬프트 저장. */
@Getter
@Setter
@Entity
@Table(name = "agent_role")
@Check(
    constraints =
        "(role_type = 'MAIN' AND main_agent_id IS NULL) OR (role_type = 'SUB' AND main_agent_id IS NOT NULL)")
public class AgentRole extends BaseTimeEntity {

  @Column(nullable = false, unique = true, length = 50)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "role_type", nullable = false, length = 20)
  private AgentRoleType roleType;

  @Column(name = "system_prompt", nullable = false, columnDefinition = "TEXT")
  private String systemPrompt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "main_agent_id")
  private AgentRole mainAgent;

  protected AgentRole() {}

  public AgentRole(String name, AgentRoleType roleType, String systemPrompt, AgentRole mainAgent) {
    this.name = name;
    this.roleType = roleType;
    this.systemPrompt = systemPrompt;
    this.mainAgent = mainAgent;
  }

  /** 저장 전 MAIN/SUB·메인 연결 불변식 검증 (배치·오케스트레이션 전제). */
  @PrePersist
  @PreUpdate
  void enforceMainSubLink() {
    if (roleType == AgentRoleType.MAIN) {
      if (mainAgent != null) {
        throw new IllegalStateException("MAIN 에이전트는 상위 메인 에이전트를 가질 수 없습니다.");
      }
      return;
    }
    if (roleType == AgentRoleType.SUB && mainAgent == null) {
      throw new IllegalStateException("SUB 에이전트는 메인 에이전트 연결이 필수입니다.");
    }
  }
}
