package com.aicastle.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 사용자-에이전트 채팅 메시지. */
@Getter
@Setter
@Entity
@Table(name = "chat_message")
public class ChatMessage extends BaseTimeEntity {

  public enum Role {
    USER,
    ASSISTANT,
    SYSTEM
  }

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_account_id", nullable = false)
  private UserAccount userAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "agent_role_id")
  private AgentRole agentRole;

  @Enumerated(EnumType.STRING)
  @Column(name = "role", nullable = false, length = 16)
  private Role role;

  @Column(name = "content", nullable = false, columnDefinition = "TEXT")
  private String content;

  @Column(name = "image_urls_json", columnDefinition = "TEXT")
  private String imageUrlsJson;

  protected ChatMessage() {}

  public ChatMessage(UserAccount userAccount, AgentRole agentRole, Role role, String content) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.role = role;
    this.content = content;
  }

  public ChatMessage(
      UserAccount userAccount,
      AgentRole agentRole,
      Role role,
      String content,
      String imageUrlsJson) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.role = role;
    this.content = content;
    this.imageUrlsJson = imageUrlsJson;
  }
}
