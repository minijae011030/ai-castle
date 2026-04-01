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

  public enum Mode {
    CHAT,
    TODO,
    TODO_NEGOTIATION
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

  @Column(name = "image_urls_json", columnDefinition = "LONGTEXT")
  private String imageUrlsJson;

  @Column(name = "progress_notes_json", columnDefinition = "TEXT")
  private String progressNotesJson;

  @Enumerated(EnumType.STRING)
  @Column(name = "chat_mode", length = 32)
  private Mode chatMode;

  protected ChatMessage() {}

  public ChatMessage(UserAccount userAccount, AgentRole agentRole, Role role, String content) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.role = role;
    this.content = content;
    this.chatMode = Mode.CHAT;
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
    this.chatMode = Mode.CHAT;
  }

  public ChatMessage(
      UserAccount userAccount,
      AgentRole agentRole,
      Role role,
      Mode chatMode,
      String content,
      String imageUrlsJson) {
    this(userAccount, agentRole, role, chatMode, content, imageUrlsJson, null);
  }

  public ChatMessage(
      UserAccount userAccount,
      AgentRole agentRole,
      Role role,
      Mode chatMode,
      String content,
      String imageUrlsJson,
      String progressNotesJson) {
    this.userAccount = userAccount;
    this.agentRole = agentRole;
    this.role = role;
    this.chatMode = chatMode;
    this.content = content;
    this.imageUrlsJson = imageUrlsJson;
    this.progressNotesJson = progressNotesJson;
  }
}
