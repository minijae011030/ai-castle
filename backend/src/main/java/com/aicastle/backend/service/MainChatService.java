package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** 메인 에이전트(김주영)와의 채팅 스켈레톤 서비스. */
@Service
public class MainChatService {

  public List<ChatMessageResponse> getRecentMessages(Long userId) {
    // TODO: 이후 DB에서 userId 기준으로 최근 N개 대화 조회
    return List.of(
        ChatMessageResponse.of(
            UUID.randomUUID().toString(),
            ChatMessageRole.SYSTEM,
            "어머니, 예서의 바이오리듬에 맞춰 오늘 일정을 조율하겠습니다.",
            Instant.now().minusSeconds(60)),
        ChatMessageResponse.of(
            UUID.randomUUID().toString(),
            ChatMessageRole.ASSISTANT,
            "오늘은 코테 2문제, SQLD 기출 1세트를 권장드립니다.",
            Instant.now().minusSeconds(30)));
  }

  public ChatMessageResponse sendMessage(Long userId, ChatSendRequest request) {
    // TODO: 이후 DB에 USER 메시지와 ASSISTANT 응답을 저장하고, OpenAI 호출로 대체
    String content = request.content() == null ? "" : request.content().trim();

    if (content.isBlank()) {
      throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
    }

    // 임시 응답: 사용자의 메시지를 받아 간단한 에코 형태로 응답
    String reply = "좋습니다. \"" + content + "\"에 맞춰 오늘 일정을 다시 조정해 보겠습니다. 우선 할 일을 조금 줄이죠.";

    return ChatMessageResponse.of(
        UUID.randomUUID().toString(), ChatMessageRole.ASSISTANT, reply, Instant.now());
  }
}
