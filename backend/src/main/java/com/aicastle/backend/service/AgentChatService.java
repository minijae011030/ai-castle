package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.repository.AgentRoleRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** 서브 에이전트와의 채팅 스켈레톤 서비스. */
@Service
public class AgentChatService {

  private final AgentRoleRepository agentRoleRepository;

  public AgentChatService(AgentRoleRepository agentRoleRepository) {
    this.agentRoleRepository = agentRoleRepository;
  }

  public List<ChatMessageResponse> getRecentMessages(Long userId, Long agentId) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    // TODO: 이후 DB에서 userId + agentId 기준으로 최근 N개 대화 조회
    String systemIntro =
        agent.getRoleType() == AgentRoleType.MAIN ? "메인 에이전트와의 대화입니다." : "서브 에이전트와의 대화입니다.";

    return List.of(
        new ChatMessageResponse(
            UUID.randomUUID().toString(),
            ChatMessageRole.SYSTEM,
            systemIntro,
            Instant.now().minusSeconds(60)),
        new ChatMessageResponse(
            UUID.randomUUID().toString(),
            ChatMessageRole.ASSISTANT,
            "어떤 부분이 가장 부담되시나요? 구체적으로 말씀해 주시면 학습량을 조정해 드리겠습니다.",
            Instant.now().minusSeconds(30)));
  }

  public ChatMessageResponse sendMessage(Long userId, Long agentId, ChatSendRequest request) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    // TODO: 이후 DB에 USER 메시지와 ASSISTANT 응답을 저장하고, OpenAI 호출로 대체
    String content = request.content() == null ? "" : request.content().trim();

    if (content.isBlank()) {
      throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
    }

    String roleLabel = agent.getRoleType() == AgentRoleType.MAIN ? "메인" : "서브";

    String reply =
        roleLabel
            + " 에이전트("
            + agent.getName()
            + ")가 요청을 확인했습니다. "
            + "지금 말씀해 주신 내용(\""
            + content
            + "\")을 반영해 학습 계획을 재조정하겠습니다.";

    return new ChatMessageResponse(
        UUID.randomUUID().toString(), ChatMessageRole.ASSISTANT, reply, Instant.now());
  }
}
