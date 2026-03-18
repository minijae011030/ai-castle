package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.ChatMessage;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.openai.OpenAiClient;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.ChatMessageRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;

/** 서브 에이전트와의 채팅 스켈레톤 서비스. */
@Service
public class AgentChatService {

  private final AgentRoleRepository agentRoleRepository;
  private final UserAccountRepository userAccountRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final OpenAiClient openAiClient;

  public AgentChatService(
      AgentRoleRepository agentRoleRepository,
      UserAccountRepository userAccountRepository,
      ChatMessageRepository chatMessageRepository,
      OpenAiClient openAiClient) {
    this.agentRoleRepository = agentRoleRepository;
    this.userAccountRepository = userAccountRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.openAiClient = openAiClient;
  }

  public List<ChatMessageResponse> getRecentMessages(Long userId, Long agentId) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    String systemIntro =
        agent.getRoleType() == AgentRoleType.MAIN ? "메인 에이전트와의 대화입니다." : "서브 에이전트와의 대화입니다.";

    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
            userId, agentId);
    List<ChatMessageResponse> result = new ArrayList<>();
    result.add(
        new ChatMessageResponse(
            "system-intro-" + agentId, ChatMessageRole.SYSTEM, systemIntro, Instant.now()));

    Collections.reverse(recentDesc); // 오래된 -> 최신
    for (ChatMessage m : recentDesc) {
      result.add(
          new ChatMessageResponse(
              String.valueOf(m.getId()),
              ChatMessageRole.valueOf(m.getRole().name()),
              m.getContent(),
              m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant()));
    }
    return result;
  }

  public ChatMessageResponse sendMessage(Long userId, Long agentId, ChatSendRequest request) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    String content = request.content() == null ? "" : request.content().trim();

    if (content.isBlank()) {
      throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
    }

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    chatMessageRepository.save(new ChatMessage(user, agent, ChatMessage.Role.USER, content));

    String roleLabel = agent.getRoleType() == AgentRoleType.MAIN ? "메인" : "서브";
    String systemPrompt =
        agent.getSystemPrompt()
            + "\n\n"
            + "너는 "
            + roleLabel
            + " 에이전트("
            + agent.getName()
            + ")다. 한국어로 간결하고 실행 가능하게 답하라.";

    String reply;
    try {
      reply = openAiClient.createChatCompletion(systemPrompt, content);
    } catch (Exception e) {
      throw new IllegalStateException("OpenAI 호출에 실패했습니다. " + e.getMessage());
    }

    ChatMessage saved =
        chatMessageRepository.save(new ChatMessage(user, agent, ChatMessage.Role.ASSISTANT, reply));

    return new ChatMessageResponse(
        String.valueOf(saved.getId()),
        ChatMessageRole.ASSISTANT,
        saved.getContent(),
        saved.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant());
  }
}
