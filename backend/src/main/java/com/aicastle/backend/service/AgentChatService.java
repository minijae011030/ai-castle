package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatHistoryPageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.dto.ChatDtos.TodoItem;
import com.aicastle.backend.dto.ChatDtos.TodoPriority;
import com.aicastle.backend.dto.ChatDtos.TodoStatus;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.ChatMessage;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.openai.OpenAiChatDtos.ImageUrlContentPart;
import com.aicastle.backend.openai.OpenAiChatDtos.ImageUrlObject;
import com.aicastle.backend.openai.OpenAiChatDtos.Message;
import com.aicastle.backend.openai.OpenAiChatDtos.TextContentPart;
import com.aicastle.backend.openai.OpenAiClient;
import com.aicastle.backend.repository.AgentPinnedMemoryRepository;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.ChatMessageRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/** 서브 에이전트와의 채팅 스켈레톤 서비스. */
@Service
public class AgentChatService {

  private static final Logger log = LoggerFactory.getLogger(AgentChatService.class);

  private final AgentRoleRepository agentRoleRepository;
  private final UserAccountRepository userAccountRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final AgentPinnedMemoryRepository agentPinnedMemoryRepository;
  private final OpenAiClient openAiClient;
  private final ObjectMapper objectMapper;

  public AgentChatService(
      AgentRoleRepository agentRoleRepository,
      UserAccountRepository userAccountRepository,
      ChatMessageRepository chatMessageRepository,
      AgentPinnedMemoryRepository agentPinnedMemoryRepository,
      OpenAiClient openAiClient,
      ObjectMapper objectMapper) {
    this.agentRoleRepository = agentRoleRepository;
    this.userAccountRepository = userAccountRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.agentPinnedMemoryRepository = agentPinnedMemoryRepository;
    this.openAiClient = openAiClient;
    this.objectMapper = objectMapper;
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
        ChatMessageResponse.of(
            "system-intro-" + agentId, ChatMessageRole.SYSTEM, systemIntro, Instant.now()));

    // repository 구현/버전에 따라 불변 리스트가 올 수 있어, reverse는 복사본에 대해 수행한다.
    List<ChatMessage> recentAsc = new ArrayList<>(recentDesc);
    Collections.reverse(recentAsc); // 오래된 -> 최신
    for (ChatMessage m : recentAsc) {
      Instant createdAt =
          m.getCreatedAt() == null
              ? Instant.now()
              : m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      result.add(toChatMessageResponse(m, createdAt));
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
          ChatMessageResponse.of(
              "system-intro-" + agentId, ChatMessageRole.SYSTEM, systemIntro, Instant.now()));
    }

    Collections.reverse(descItems); // 오래된 -> 최신
    for (ChatMessage m : descItems) {
      Instant createdAt =
          m.getCreatedAt() == null
              ? Instant.now()
              : m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      items.add(toChatMessageResponse(m, createdAt));
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

    // 프론트에서 전달되는 이미지 URL(들). 비어 있으면 CHAT 입력만 사용한다.
    List<String> imageUrls = request.imageUrls() == null ? List.of() : request.imageUrls();

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
    ChatMode mode = request.mode();
    String modePrompt =
        mode == ChatMode.TODO
            ? "\n\n[모드: TODO]\n- 반드시 JSON만 출력하라. (설명 문장/마크다운/코드블록 금지)\n- 스키마: {\"text\": string, \"todo\": [{\"title\": string, \"description\": string|null, \"estimateMinutes\": number|null, \"priority\": \"LOW\"|\"MEDIUM\"|\"HIGH\", \"status\": \"TODO\"|\"DONE\", \"scheduledDate\": \"YYYY-MM-DD\", \"startAt\": \"YYYY-MM-DDTHH:mm:ss\", \"endAt\": \"YYYY-MM-DDTHH:mm:ss\"}]}\n- 모든 todo 항목에 날짜/시간을 반드시 포함하라.\n- todo 항목은 짧고 측정 가능해야 한다.\n"
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

      Object userMessageContent = buildUserMessageContent(content, imageUrls);

      messages.add(new Message("user", userMessageContent));

      reply =
          mode == ChatMode.TODO
              ? openAiClient.createTodoJsonWithMessages(messages)
              : (!imageUrls.isEmpty()
                  ? openAiClient.createVisionResponseWithMessages(messages)
                  : openAiClient.createChatCompletionWithMessages(messages));
    } catch (Exception e) {
      throw new IllegalStateException("OpenAI 호출에 실패했습니다. " + e.getMessage());
    }

    ChatMessage saved =
        chatMessageRepository.save(new ChatMessage(user, agent, ChatMessage.Role.ASSISTANT, reply));

    Instant createdAt = saved.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
    return toChatMessageResponse(saved, createdAt);
  }

  private ChatMessageResponse toChatMessageResponse(ChatMessage message, Instant createdAt) {
    String id = String.valueOf(message.getId());
    ChatMessageRole role = ChatMessageRole.valueOf(message.getRole().name());
    String rawContent = message.getContent() == null ? "" : message.getContent();

    // TODO 모드 응답은 DB에 JSON 원문이 저장될 수 있다. 가능하면 파싱해서 content=text, todo=list로 내려준다.
    if (role == ChatMessageRole.ASSISTANT) {
      TodoJsonParsed parsed = tryParseTodoJson(rawContent);
      if (parsed != null) {
        return new ChatMessageResponse(id, role, parsed.text(), createdAt, parsed.todo());
      }
    }

    return ChatMessageResponse.of(id, role, rawContent, createdAt);
  }

  // OpenAI vision 입력을 위해, user message content를 multipart 형식으로 만든다.
  // 이미지가 없으면 string content 그대로 유지한다.
  private Object buildUserMessageContent(String content, List<String> imageUrls) {
    if (imageUrls == null || imageUrls.isEmpty()) return content;

    List<Object> parts = new ArrayList<>();
    // 이미지가 첨부되면 모델이 반드시 이미지를 먼저 활용하도록 명시적으로 지시한다.
    // (이미지 파싱이 동작하는지 빠르게 판별하기 위해 문장을 고정한다.)
    String visionInstruction = "\n\n[이미지 분석 요청]\n첨부된 이미지를 먼저 확인한 뒤, 이미지 내용에 근거해서 답변해줘.";
    parts.add(new TextContentPart("text", (content == null ? "" : content) + visionInstruction));

    for (String imageUrl : imageUrls) {
      if (imageUrl == null) continue;
      String trimmed = imageUrl.trim();
      if (trimmed.isEmpty()) continue;
      parts.add(new ImageUrlContentPart("image_url", new ImageUrlObject(trimmed)));
    }

    // 유효한 이미지 URL이 하나도 없으면 기존 string 전송으로 폴백
    if (parts.size() == 1) return content;
    return parts;
  }

  private record TodoJsonParsed(String text, List<TodoItem> todo) {}

  private TodoJsonParsed tryParseTodoJson(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    if (trimmed.isEmpty()) return null;
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

    try {
      JsonNode root = objectMapper.readTree(trimmed);
      if (root == null || !root.isObject()) return null;
      JsonNode textNode = root.get("text");
      JsonNode todoNode = root.get("todo");
      if (textNode == null || !textNode.isTextual()) return null;
      if (todoNode == null || !todoNode.isArray()) return null;

      String text = textNode.asText("");
      List<TodoItem> todo = new ArrayList<>();
      for (JsonNode item : todoNode) {
        if (item == null || !item.isObject()) continue;

        String title = item.path("title").asText("").trim();
        if (title.isEmpty()) continue;

        String description =
            item.hasNonNull("description") ? item.path("description").asText(null) : null;
        Integer estimateMinutes =
            item.hasNonNull("estimateMinutes") ? item.path("estimateMinutes").asInt() : null;

        TodoPriority priority =
            parseEnumOrDefault(item.path("priority").asText(null), TodoPriority.MEDIUM);
        TodoStatus status = parseEnumOrDefault(item.path("status").asText(null), TodoStatus.TODO);
        String scheduledDate = item.path("scheduledDate").asText("").trim();
        String startAt = item.path("startAt").asText("").trim();
        String endAt = item.path("endAt").asText("").trim();

        if (scheduledDate.isEmpty() || startAt.isEmpty() || endAt.isEmpty()) {
          continue;
        }

        todo.add(
            new TodoItem(
                title,
                description,
                estimateMinutes,
                priority,
                status,
                scheduledDate,
                startAt,
                endAt));
      }

      return new TodoJsonParsed(text, todo);
    } catch (Exception ignored) {
      return null;
    }
  }

  private static <T extends Enum<T>> T parseEnumOrDefault(String raw, T defaultValue) {
    if (raw == null || raw.isBlank()) return defaultValue;
    try {
      @SuppressWarnings("unchecked")
      T parsed = (T) Enum.valueOf(defaultValue.getDeclaringClass(), raw.trim().toUpperCase());
      return parsed;
    } catch (Exception ignored) {
      return defaultValue;
    }
  }
}
