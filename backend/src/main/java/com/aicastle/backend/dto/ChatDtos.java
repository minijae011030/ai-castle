package com.aicastle.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

  public enum TodoPriority {
    LOW,
    MEDIUM,
    HIGH
  }

  public enum TodoStatus {
    TODO,
    DONE
  }

  public record TodoItem(
      String title,
      String description,
      Integer estimateMinutes,
      TodoPriority priority,
      TodoStatus status,
      String scheduledDate,
      String startAt,
      String endAt) {}

  public record ChatMessageResponse(
      String id,
      ChatMessageRole role,
      String content,
      Instant createdAt,
      java.util.List<TodoItem> todo) {

    public static ChatMessageResponse of(
        String id, ChatMessageRole role, String content, Instant createdAt) {
      return new ChatMessageResponse(id, role, content, createdAt, null);
    }
  }

  public record ChatSendRequest(@NotBlank String content, @NotNull ChatMode mode) {}

  /** 커서 기반 채팅 히스토리 페이지 응답. (오래된 -> 최신 순서) */
  public record ChatHistoryPageResponse(
      java.util.List<ChatMessageResponse> items, Long nextBeforeId, boolean hasMore) {}
}
