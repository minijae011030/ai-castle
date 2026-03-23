package com.aicastle.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

/** 메인/에이전트 채팅 공용 DTO. */
public class ChatDtos {

  public enum ChatMode {
    CHAT,
    TODO,
    TODO_NEGOTIATION
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
      Integer sourceScheduleId,
      TodoPriority priority,
      TodoStatus status,
      String scheduledDate,
      String startAt,
      String endAt) {}

  public record ChatMessageResponse(
      String id,
      ChatMessageRole role,
      ChatMode mode,
      String content,
      Instant createdAt,
      java.util.List<TodoItem> todo,
      java.util.List<String> imageUrls) {

    public static ChatMessageResponse of(
        String id, ChatMessageRole role, ChatMode mode, String content, Instant createdAt) {
      return new ChatMessageResponse(id, role, mode, content, createdAt, null, null);
    }
  }

  public record NegotiationTodoRequestItem(
      Long scheduleId, String title, String occurrenceDate, String startAt, String endAt) {}

  public record ChatSendRequest(
      @NotBlank String content,
      @NotNull ChatMode mode,
      // 이미지 첨부는 선택 사항 (VISION용 URL만 프론트 -> 백엔드로 전달)
      List<String> imageUrls,
      // 조정 요청 모드에서 선택한 TODO 컨텍스트
      List<NegotiationTodoRequestItem> negotiationTodos,
      // 조정 희망 마감일(선택)
      String preferredDeadlineDate) {}

  /** 커서 기반 채팅 히스토리 페이지 응답. (오래된 -> 최신 순서) */
  public record ChatHistoryPageResponse(
      java.util.List<ChatMessageResponse> items, Long nextBeforeId, boolean hasMore) {}
}
