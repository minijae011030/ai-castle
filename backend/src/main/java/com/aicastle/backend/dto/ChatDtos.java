package com.aicastle.backend.dto;

import java.time.Instant;

/** 메인/에이전트 채팅 공용 DTO. */
public class ChatDtos {

  public enum ChatMessageRole {
    USER,
    ASSISTANT,
    SYSTEM
  }

  public record ChatMessageResponse(
      String id, ChatMessageRole role, String content, Instant createdAt) {}

  public record ChatSendRequest(String content) {}
}
