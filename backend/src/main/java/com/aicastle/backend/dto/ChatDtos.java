package com.aicastle.backend.dto;

import java.time.Instant;

/** 메인/에이전트 채팅 공용 DTO. */
public class ChatDtos {

  public enum ChatMode {
    CHAT,
    TODO
  }

  public enum ChatMessageRole {
    USER,
    ASSISTANT,
    SYSTEM
  }

  public record ChatMessageResponse(
      String id, ChatMessageRole role, String content, Instant createdAt) {}

  public record ChatSendRequest(String content, ChatMode mode) {}

  /** 커서 기반 채팅 히스토리 페이지 응답. (오래된 -> 최신 순서) */
  public record ChatHistoryPageResponse(
      java.util.List<ChatMessageResponse> items, Long nextBeforeId, boolean hasMore) {}
}
