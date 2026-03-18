package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatHistoryPageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.ChatMessage;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.openai.OpenAiChatDtos.Message;
import com.aicastle.backend.openai.OpenAiClient;
import com.aicastle.backend.repository.AgentPinnedMemoryRepository;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.ChatMessageRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/** 서브 에이전트와의 채팅 스켈레톤 서비스. */
@Service
public class AgentChatService {

  private final AgentRoleRepository agentRoleRepository;
  private final UserAccountRepository userAccountRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final AgentPinnedMemoryRepository agentPinnedMemoryRepository;
  private final OpenAiClient openAiClient;

  public AgentChatService(
      AgentRoleRepository agentRoleRepository,
      UserAccountRepository userAccountRepository,
      ChatMessageRepository chatMessageRepository,
      AgentPinnedMemoryRepository agentPinnedMemoryRepository,
      OpenAiClient openAiClient) {
    this.agentRoleRepository = agentRoleRepository;
    this.userAccountRepository = userAccountRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.agentPinnedMemoryRepository = agentPinnedMemoryRepository;
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

    // repository 구현/버전에 따라 불변 리스트가 올 수 있어, reverse는 복사본에 대해 수행한다.
    List<ChatMessage> recentAsc = new ArrayList<>(recentDesc);
    Collections.reverse(recentAsc); // 오래된 -> 최신
    for (ChatMessage m : recentAsc) {
      Instant createdAt =
          m.getCreatedAt() == null
              ? Instant.now()
              : m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      result.add(
          new ChatMessageResponse(
              String.valueOf(m.getId()),
              ChatMessageRole.valueOf(m.getRole().name()),
              m.getContent(),
              createdAt));
    }
    return result;
  }

  /** 커서 기반 히스토리 조회. beforeId가 null이면 최신 페이지를 반환한다. */
  public ChatHistoryPageResponse getMessagesPage(
      Long userId, Long agentId, Long beforeId, int limit) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    int safeLimit = Math.max(1, Math.min(limit, 50));
    PageRequest pageRequest = PageRequest.of(0, safeLimit);

    Page<ChatMessage> page =
        beforeId == null
            ? chatMessageRepository.findByUserAccount_IdAndAgentRole_IdOrderByIdDesc(
                userId, agentId, pageRequest)
            : chatMessageRepository.findByUserAccount_IdAndAgentRole_IdAndIdLessThanOrderByIdDesc(
                userId, agentId, beforeId, pageRequest);

    // Page.getContent()가 불변 리스트일 수 있어, 항상 mutable로 복사한다.
    List<ChatMessage> descItems = new ArrayList<>(page.getContent()); // 최신 -> 과거
    List<ChatMessageResponse> items = new ArrayList<>();

    // 첫 페이지(최신 구간)에서만 시스템 인트로를 1번 넣는다.
    if (beforeId == null) {
      String systemIntro =
          agent.getRoleType() == AgentRoleType.MAIN ? "메인 에이전트와의 대화입니다." : "서브 에이전트와의 대화입니다.";
      items.add(
          new ChatMessageResponse(
              "system-intro-" + agentId, ChatMessageRole.SYSTEM, systemIntro, Instant.now()));
    }

    Collections.reverse(descItems); // 오래된 -> 최신
    for (ChatMessage m : descItems) {
      Instant createdAt =
          m.getCreatedAt() == null
              ? Instant.now()
              : m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      items.add(
          new ChatMessageResponse(
              String.valueOf(m.getId()),
              ChatMessageRole.valueOf(m.getRole().name()),
              m.getContent(),
              createdAt));
    }

    Long nextBeforeId = descItems.isEmpty() ? null : descItems.get(0).getId();
    boolean hasMore = page.hasNext();

    return new ChatHistoryPageResponse(items, nextBeforeId, hasMore);
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

    // 컨텍스트를 위해, OpenAI 호출 전 "직전 대화"를 먼저 조회한다. (현재 메시지는 별도로 마지막에 추가)
    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
            userId, agentId);

    chatMessageRepository.save(new ChatMessage(user, agent, ChatMessage.Role.USER, content));

    String roleLabel = agent.getRoleType() == AgentRoleType.MAIN ? "메인" : "서브";
    ChatMode mode = request.mode() == null ? ChatMode.CHAT : request.mode();
    String modePrompt =
        mode == ChatMode.TODO
            ? "\n\n[모드: TODO]\n- 사용자의 요청을 실행 가능한 TODO 체크리스트로 변환해라.\n- 마크다운으로 답하라.\n- 각 항목은 짧고 측정 가능해야 한다.\n"
            : "\n\n[모드: CHAT]\n- 자연스러운 대화로 답하라.\n";

    String systemPrompt =
        agent.getSystemPrompt()
            + "\n\n"
            + "너는 "
            + roleLabel
            + " 에이전트("
            + agent.getName()
            + ")다. 한국어로 간결하고 실행 가능하게 답하라."
            + modePrompt;

    String reply;
    try {
      List<Message> messages = new ArrayList<>();
      // 시스템 프롬프트는 한 번만 넣고, 이후는 히스토리 + 현재 유저 메시지로 컨텍스트를 구성한다.
      messages.add(new Message("system", systemPrompt));

      // 고정 메모리(최대 10개)를 항상 주입한다. (사용자 직접 관리, FIFO 금지)
      var pinnedMemories =
          agentPinnedMemoryRepository.findByUserAccount_IdAndAgentRole_IdOrderByCreatedAtAsc(
              userId, agentId);
      if (!pinnedMemories.isEmpty()) {
        StringBuilder sb = new StringBuilder();
        sb.append("[고정 메모리]\n");
        for (int i = 0; i < pinnedMemories.size(); i++) {
          String mem = pinnedMemories.get(i).getContent();
          if (mem == null || mem.isBlank()) continue;
          sb.append("- ").append(mem.trim()).append("\n");
        }
        messages.add(new Message("system", sb.toString().trim()));
      }

      // 최근 대화 슬라이딩 윈도우(최근 N개) 주입
      List<ChatMessage> recentAsc = new ArrayList<>(recentDesc);
      Collections.reverse(recentAsc); // 오래된 -> 최신
      for (ChatMessage m : recentAsc) {
        if (m == null || m.getContent() == null || m.getContent().isBlank()) {
          continue;
        }
        String role = m.getRole() == ChatMessage.Role.USER ? "user" : "assistant";
        messages.add(new Message(role, m.getContent()));
      }

      messages.add(new Message("user", content));

      reply = openAiClient.createChatCompletionWithMessages(messages);
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
