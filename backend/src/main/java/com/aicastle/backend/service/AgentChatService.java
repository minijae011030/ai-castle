package com.aicastle.backend.service;

import com.aicastle.backend.agentchat.planning.AgentChatPlanningSupport;
import com.aicastle.backend.agentchat.prompt.AgentSystemPromptBuilder;
import com.aicastle.backend.dto.ChatDtos.ChatHistoryPageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageRole;
import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.dto.ChatDtos.NegotiationTodoRequestItem;
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
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

/** 서브 에이전트와의 채팅 스켈레톤 서비스. */
@Service
public class AgentChatService {

  private static final Logger log = LoggerFactory.getLogger(AgentChatService.class);

  /** 일정·TODO 제안 시 날짜 혼동 방지 (모델이 과거 연도를 쓰는 문제 완화). */
  private static final ZoneId PLANNER_ZONE_ID = ZoneId.of("Asia/Seoul");

  private final AgentRoleRepository agentRoleRepository;
  private final UserAccountRepository userAccountRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final AgentPinnedMemoryRepository agentPinnedMemoryRepository;
  private final AgentChatPlanningSupport agentChatPlanningSupport;
  private final AgentSystemPromptBuilder agentSystemPromptBuilder;
  private final OpenAiClient openAiClient;
  private final ObjectMapper objectMapper;

  public AgentChatService(
      AgentRoleRepository agentRoleRepository,
      UserAccountRepository userAccountRepository,
      ChatMessageRepository chatMessageRepository,
      AgentPinnedMemoryRepository agentPinnedMemoryRepository,
      AgentChatPlanningSupport agentChatPlanningSupport,
      AgentSystemPromptBuilder agentSystemPromptBuilder,
      OpenAiClient openAiClient,
      ObjectMapper objectMapper) {
    this.agentRoleRepository = agentRoleRepository;
    this.userAccountRepository = userAccountRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.agentPinnedMemoryRepository = agentPinnedMemoryRepository;
    this.agentChatPlanningSupport = agentChatPlanningSupport;
    this.agentSystemPromptBuilder = agentSystemPromptBuilder;
    this.openAiClient = openAiClient;
    this.objectMapper = objectMapper;
  }

  public List<ChatMessageResponse> getRecentMessages(Long userId, Long agentId) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));
    assertSubAgentLinkedToMain(agent);

    String systemIntro =
        agent.getRoleType() == AgentRoleType.MAIN ? "메인 에이전트와의 대화입니다." : "서브 에이전트와의 대화입니다.";

    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
            userId, agentId);
    List<ChatMessageResponse> result = new ArrayList<>();
    result.add(
        ChatMessageResponse.of(
            "system-intro-" + agentId,
            ChatMessageRole.SYSTEM,
            ChatMode.CHAT,
            systemIntro,
            Instant.now()));

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
    assertSubAgentLinkedToMain(agent);

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
              "system-intro-" + agentId,
              ChatMessageRole.SYSTEM,
              ChatMode.CHAT,
              systemIntro,
              Instant.now()));
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
    return sendMessageInternal(userId, agentId, request, null);
  }

  private ChatMessageResponse sendMessageInternal(
      Long userId, Long agentId, ChatSendRequest request, Consumer<String> progressEmitter) {
    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));
    assertSubAgentLinkedToMain(agent);

    String content = request.content() == null ? "" : request.content().trim();

    if (content.isBlank()) {
      throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
    }

    // 프론트에서 전달되는 이미지 URL(들). 비어 있으면 CHAT 입력만 사용한다.
    List<String> imageUrls = request.imageUrls() == null ? List.of() : request.imageUrls();
    List<NegotiationTodoRequestItem> negotiationTodos =
        request.negotiationTodos() == null ? List.of() : request.negotiationTodos();
    String preferredDeadlineDate =
        request.preferredDeadlineDate() == null ? "" : request.preferredDeadlineDate().trim();
    ChatMode mode =
        resolveAgentChatMode(
            request.mode(),
            content,
            imageUrls,
            request.negotiationTodos() == null ? List.of() : request.negotiationTodos());

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    // 컨텍스트를 위해, OpenAI 호출 전 "직전 대화"를 먼저 조회한다. (현재 메시지는 별도로 마지막에 추가)
    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
            userId, agentId);

    String userImageUrlsJson = toImageUrlsJson(imageUrls);
    ChatMessage.Mode entityMode = parseEntityMode(mode);
    chatMessageRepository.save(
        new ChatMessage(
            user, agent, ChatMessage.Role.USER, entityMode, content, userImageUrlsJson));

    String systemPrompt = agentSystemPromptBuilder.build(agent, mode, PLANNER_ZONE_ID);
    if (mode == ChatMode.CHAT) {
      systemPrompt += agentChatPlanningSupport.buildChatLightInferenceHint(userId, content);
    }

    String reply;
    List<String> progressNotes = null;
    try {
      if (mode == ChatMode.TODO_NEGOTIATION) {
        progressNotes = new ArrayList<>();
        List<String> progressNotesRef = progressNotes;
        Consumer<String> progressSink =
            message -> {
              progressNotesRef.add(message);
              if (progressEmitter != null) progressEmitter.accept(message);
            };
        reply =
            agentChatPlanningSupport.runNegotiationToolLoop(
                userId, content, negotiationTodos, preferredDeadlineDate, progressSink);
      } else if (mode == ChatMode.TODO) {
        progressNotes = new ArrayList<>();
        List<String> progressNotesRef = progressNotes;
        Consumer<String> progressSink =
            message -> {
              progressNotesRef.add(message);
              if (progressEmitter != null) progressEmitter.accept(message);
            };
        reply =
            agentChatPlanningSupport.runTodoToolLoop(
                userId, agentId, content, systemPrompt, progressSink);
      } else {
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

        String normalizedContent =
            mode == ChatMode.TODO_NEGOTIATION
                ? agentChatPlanningSupport.buildNegotiationContext(
                    content, negotiationTodos, preferredDeadlineDate)
                : content;

        Object userMessageContent = buildUserMessageContent(normalizedContent, imageUrls);

        messages.add(new Message("user", userMessageContent));

        reply =
            mode == ChatMode.TODO || mode == ChatMode.TODO_NEGOTIATION
                ? openAiClient.createTodoJsonWithMessages(messages)
                : (!imageUrls.isEmpty()
                    ? openAiClient.createVisionResponseWithMessages(messages)
                    : openAiClient.createChatCompletionWithMessages(messages));
      }
    } catch (Exception e) {
      throw new IllegalStateException("OpenAI 호출에 실패했습니다. " + e.getMessage());
    }

    ChatMessage saved =
        chatMessageRepository.save(
            new ChatMessage(
                user,
                agent,
                ChatMessage.Role.ASSISTANT,
                entityMode,
                reply,
                null,
                toProgressNotesJson(progressNotes)));

    Instant createdAt = saved.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
    return toChatMessageResponse(saved, createdAt);
  }

  /**
   * NDJSON 스트리밍으로 assistant 응답을 점진적으로 전송한다.
   *
   * <p>현재는 UX 목적상 CHAT(텍스트)만 스트리밍을 적용한다. (이미지/구조화 TODO는 기존 방식 유지)
   */
  public void sendMessageStreamNdjson(
      Long userId, Long agentId, ChatSendRequest request, ResponseBodyEmitter emitter)
      throws IOException {
    if (emitter == null) {
      throw new IllegalArgumentException("emitter 는 null 일 수 없습니다.");
    }

    log.info("👉 [에이전트 채팅 스트림] 시작 userId={}, agentId={}", userId, agentId);
    // 프론트가 빠르게 렌더링할 수 있도록 시작 이벤트를 먼저 보낸다.
    writeNdjson(emitter, Map.of("type", "started"));

    try {
      AgentRole agent =
          agentRoleRepository
              .findById(agentId)
              .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));
      assertSubAgentLinkedToMain(agent);

      String content = request.content() == null ? "" : request.content().trim();
      if (content.isBlank()) {
        throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
      }

      List<String> imageUrls = request.imageUrls() == null ? List.of() : request.imageUrls();
      List<NegotiationTodoRequestItem> negotiationTodosForRouting =
          request.negotiationTodos() == null ? List.of() : request.negotiationTodos();
      ChatMode mode =
          resolveAgentChatMode(request.mode(), content, imageUrls, negotiationTodosForRouting);
      ChatSendRequest normalizedRequest =
          new ChatSendRequest(
              content,
              mode,
              imageUrls,
              negotiationTodosForRouting,
              request.preferredDeadlineDate());

      // TODO/협상/이미지 모드는 스트리밍 복잡도가 높아 기존 방식으로 처리 (1회만 내려줌)
      boolean canStream = mode == ChatMode.CHAT && (imageUrls == null || imageUrls.isEmpty());
      log.info(
          "👉 [에이전트 채팅 스트림] 모드 판정 mode={}, canStream={}, imageCount={}",
          mode,
          canStream,
          imageUrls == null ? 0 : imageUrls.size());
      if (!canStream) {
        ChatMessageResponse data =
            sendMessageInternal(
                userId,
                agentId,
                normalizedRequest,
                progressNote -> {
                  try {
                    writeNdjson(emitter, Map.of("type", "delta", "text", progressNote + "\n"));
                  } catch (IOException ioException) {
                    throw new RuntimeException(ioException);
                  }
                });
        log.info("👉 [에이전트 채팅 스트림] 비스트림 폴백 전송 완료 messageId={}", data.id());
        writeNdjson(emitter, Map.of("type", "final", "message", data));
        emitter.complete();
        return;
      }

      UserAccount user =
          userAccountRepository
              .findById(userId)
              .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

      List<ChatMessage> recentDesc =
          chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
              userId, agentId);

      // 유저 메시지 저장
      chatMessageRepository.save(
          new ChatMessage(
              user, agent, ChatMessage.Role.USER, ChatMessage.Mode.CHAT, content, null));

      String systemPrompt = agentSystemPromptBuilder.build(agent, ChatMode.CHAT, PLANNER_ZONE_ID);
      systemPrompt += agentChatPlanningSupport.buildChatLightInferenceHint(userId, content);

      List<Message> messages = new ArrayList<>();
      messages.add(new Message("system", systemPrompt));

      // 고정 메모리 주입
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

      // 최근 대화 슬라이딩 윈도우 주입
      List<ChatMessage> recentAsc = new ArrayList<>(recentDesc);
      Collections.reverse(recentAsc);
      for (ChatMessage m : recentAsc) {
        if (m == null || m.getContent() == null || m.getContent().isBlank()) continue;
        String role = m.getRole() == ChatMessage.Role.USER ? "user" : "assistant";
        messages.add(new Message(role, m.getContent()));
      }

      messages.add(new Message("user", content));

      AtomicReference<StringBuilder> assembled = new AtomicReference<>(new StringBuilder());
      AtomicBoolean hadStreamError = new AtomicBoolean(false);

      openAiClient.streamChatCompletionWithMessages(
          messages,
          delta -> {
            try {
              assembled.get().append(delta);
              // 프론트는 delta를 이어붙여 렌더링
              writeNdjson(emitter, Map.of("type", "delta", "text", delta));
            } catch (Exception e) {
              hadStreamError.set(true);
              log.warn("👉 [에이전트 채팅 스트림] 델타 전송 실패 message={}", e.getMessage());
            }
          },
          errorMessage -> {
            try {
              hadStreamError.set(true);
              log.warn("👉 [에이전트 채팅 스트림] OpenAI 스트림 오류 message={}", errorMessage);
              writeNdjson(emitter, Map.of("type", "error", "message", errorMessage));
            } catch (Exception ignored) {
              log.warn("👉 [에이전트 채팅 스트림] 에러 프레임 전송 실패");
            }
          });

      String finalText = assembled.get().toString();
      log.info(
          "👉 [에이전트 채팅 스트림] 응답 조립 완료 length={}, hadStreamError={}",
          finalText.length(),
          hadStreamError.get());
      if (finalText.isBlank()) {
        // OpenAI 스트림 이벤트 포맷 차이 등으로 delta가 비는 경우를 대비해 즉시 폴백한다.
        String fallbackReply = openAiClient.createChatCompletionWithMessages(messages);
        if (fallbackReply != null && !fallbackReply.isBlank()) {
          log.info("👉 [에이전트 채팅 스트림] 빈 스트림 폴백 성공 length={}", fallbackReply.length());
          finalText = fallbackReply;
        } else if (hadStreamError.get()) {
          throw new IllegalStateException("스트리밍 응답을 생성하지 못했습니다.");
        } else {
          finalText = "";
        }
      }

      ChatMessage saved =
          chatMessageRepository.save(
              new ChatMessage(
                  user, agent, ChatMessage.Role.ASSISTANT, ChatMessage.Mode.CHAT, finalText, null));

      Instant createdAt = saved.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      ChatMessageResponse response = toChatMessageResponse(saved, createdAt);
      writeNdjson(emitter, Map.of("type", "final", "message", response));
      log.info(
          "👉 [에이전트 채팅 스트림] 최종 응답 전송 완료 messageId={}, contentLength={}",
          response.id(),
          response.content().length());
      emitter.complete();
    } catch (Exception e) {
      log.error(
          "👉 [에이전트 채팅 스트림] 처리 실패 userId={}, agentId={}, reason={}",
          userId,
          agentId,
          e.getMessage(),
          e);
      writeNdjson(
          emitter,
          Map.of(
              "type", "error", "message", e.getMessage() == null ? "오류가 발생했습니다." : e.getMessage()));
      // chunked 응답에서 completeWithError는 브라우저에서 ERR_INCOMPLETE_CHUNKED_ENCODING으로 보일 수 있다.
      // 에러 이벤트를 이미 내려보냈으므로 정상 complete로 닫는다.
      emitter.complete();
    }
  }

  public void sendMessageStream(
      Long userId,
      Long agentId,
      ChatSendRequest request,
      Consumer<String> onDelta,
      Consumer<ChatMessageResponse> onFinal,
      Consumer<String> onError) {
    try {
      AgentRole agent =
          agentRoleRepository
              .findById(agentId)
              .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));
      assertSubAgentLinkedToMain(agent);

      String content = request.content() == null ? "" : request.content().trim();
      if (content.isBlank()) {
        throw new IllegalArgumentException("메시지 내용은 비어 있을 수 없습니다.");
      }

      List<String> imageUrls = request.imageUrls() == null ? List.of() : request.imageUrls();
      List<NegotiationTodoRequestItem> negotiationTodosForRouting =
          request.negotiationTodos() == null ? List.of() : request.negotiationTodos();
      ChatMode mode =
          resolveAgentChatMode(request.mode(), content, imageUrls, negotiationTodosForRouting);
      ChatSendRequest normalizedRequest =
          new ChatSendRequest(
              content,
              mode,
              imageUrls,
              negotiationTodosForRouting,
              request.preferredDeadlineDate());
      boolean canStream = mode == ChatMode.CHAT && (imageUrls == null || imageUrls.isEmpty());
      if (!canStream) {
        onFinal.accept(sendMessage(userId, agentId, normalizedRequest));
        return;
      }

      UserAccount user =
          userAccountRepository
              .findById(userId)
              .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
      List<ChatMessage> recentDesc =
          chatMessageRepository.findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
              userId, agentId);
      chatMessageRepository.save(
          new ChatMessage(
              user, agent, ChatMessage.Role.USER, ChatMessage.Mode.CHAT, content, null));

      String systemPrompt = agentSystemPromptBuilder.build(agent, ChatMode.CHAT, PLANNER_ZONE_ID);
      systemPrompt += agentChatPlanningSupport.buildChatLightInferenceHint(userId, content);

      List<Message> messages = new ArrayList<>();
      messages.add(new Message("system", systemPrompt));
      List<ChatMessage> recentAsc = new ArrayList<>(recentDesc);
      Collections.reverse(recentAsc);
      for (ChatMessage m : recentAsc) {
        if (m == null || m.getContent() == null || m.getContent().isBlank()) continue;
        messages.add(
            new Message(
                m.getRole() == ChatMessage.Role.USER ? "user" : "assistant", m.getContent()));
      }
      messages.add(new Message("user", content));

      StringBuilder assembled = new StringBuilder();
      openAiClient.streamChatCompletionWithMessages(
          messages,
          delta -> {
            assembled.append(delta);
            onDelta.accept(delta);
          },
          onError);

      // WS에서 답변 누락이 보이면 non-stream completion으로 보정한다.
      if (assembled.toString().isBlank()) {
        String fallbackReply = openAiClient.createChatCompletionWithMessages(messages);
        if (fallbackReply != null && !fallbackReply.isBlank()) {
          assembled.append(fallbackReply);
        }
      }

      ChatMessage saved =
          chatMessageRepository.save(
              new ChatMessage(
                  user,
                  agent,
                  ChatMessage.Role.ASSISTANT,
                  ChatMessage.Mode.CHAT,
                  assembled.toString(),
                  null));
      Instant createdAt = saved.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
      onFinal.accept(toChatMessageResponse(saved, createdAt));
    } catch (Exception e) {
      onError.accept(e.getMessage() == null ? "오류가 발생했습니다." : e.getMessage());
    }
  }

  private void writeNdjson(ResponseBodyEmitter emitter, Object payload) throws IOException {
    String json = objectMapper.writeValueAsString(payload);
    emitter.send(json + "\n", org.springframework.http.MediaType.APPLICATION_NDJSON);
    // 일부 프록시/브라우저에서 flush 타이밍 이슈가 있어 문자열로 확실히 보낸다.
    emitter.send("", org.springframework.http.MediaType.TEXT_PLAIN);
  }

  private ChatMessageResponse toChatMessageResponse(ChatMessage message, Instant createdAt) {
    String id = String.valueOf(message.getId());
    ChatMessageRole role = ChatMessageRole.valueOf(message.getRole().name());
    String rawContent = message.getContent() == null ? "" : message.getContent();

    // TODO 모드 응답은 DB에 JSON 원문이 저장될 수 있다. 가능하면 파싱해서 content=text, todo=list로 내려준다.
    if (role == ChatMessageRole.ASSISTANT) {
      TodoJsonParsed parsed = tryParseTodoJson(rawContent);
      if (parsed != null) {
        return new ChatMessageResponse(
            id,
            role,
            parseChatMode(message),
            parsed.text(),
            createdAt,
            parsed.todo(),
            parseImageUrls(message),
            parsed.groupTitle(),
            parseProgressNotes(message));
      }
    }

    return new ChatMessageResponse(
        id,
        role,
        parseChatMode(message),
        rawContent,
        createdAt,
        null,
        parseImageUrls(message),
        null,
        parseProgressNotes(message));
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

  private record TodoJsonParsed(String text, String groupTitle, List<TodoItem> todo) {}

  private TodoJsonParsed tryParseTodoJson(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    if (trimmed.isEmpty()) return null;
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

    try {
      JsonNode root = objectMapper.readTree(trimmed);
      if (root == null || !root.isObject()) return null;
      JsonNode textNode = root.get("text");
      JsonNode groupTitleNode = root.get("groupTitle");
      JsonNode todoNode = root.get("todo");
      if (textNode == null || !textNode.isTextual()) return null;
      if (todoNode == null || !todoNode.isArray()) return null;

      String text = textNode.asText("");
      String groupTitle =
          groupTitleNode != null && groupTitleNode.isTextual()
              ? groupTitleNode.asText("").trim()
              : "";
      if (groupTitle.isBlank()) groupTitle = "그룹";
      List<TodoItem> todo = new ArrayList<>();
      for (JsonNode item : todoNode) {
        if (item == null || !item.isObject()) continue;

        String title = item.path("title").asText("").trim();
        if (title.isEmpty()) continue;

        String description =
            item.hasNonNull("description") ? item.path("description").asText(null) : null;
        Integer estimateMinutes =
            item.hasNonNull("estimateMinutes") ? item.path("estimateMinutes").asInt() : null;
        Integer sourceScheduleId =
            item.hasNonNull("sourceScheduleId") ? item.path("sourceScheduleId").asInt() : null;

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
                sourceScheduleId,
                priority,
                status,
                scheduledDate,
                startAt,
                endAt));
      }

      return new TodoJsonParsed(text, groupTitle, todo);
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

  private ChatMode parseChatMode(ChatMessage message) {
    if (message == null || message.getChatMode() == null) return ChatMode.CHAT;
    try {
      return ChatMode.valueOf(message.getChatMode().name());
    } catch (Exception ignored) {
      return ChatMode.CHAT;
    }
  }

  private ChatMessage.Mode parseEntityMode(ChatMode mode) {
    if (mode == null) return ChatMessage.Mode.CHAT;
    try {
      return ChatMessage.Mode.valueOf(mode.name());
    } catch (Exception ignored) {
      return ChatMessage.Mode.CHAT;
    }
  }

  private ChatMode resolveAgentChatMode(
      ChatMode requestedMode,
      String content,
      List<String> imageUrls,
      List<NegotiationTodoRequestItem> negotiationTodos) {
    if (requestedMode != null) return requestedMode;
    return agentChatPlanningSupport.routeChatMode(content, imageUrls, negotiationTodos);
  }

  private String toImageUrlsJson(List<String> imageUrls) {
    if (imageUrls == null || imageUrls.isEmpty()) return null;
    List<String> sanitizedImageUrls = new ArrayList<>();
    for (String imageUrl : imageUrls) {
      if (imageUrl == null) continue;
      String trimmedImageUrl = imageUrl.trim();
      if (trimmedImageUrl.isEmpty()) continue;
      sanitizedImageUrls.add(trimmedImageUrl);
    }
    if (sanitizedImageUrls.isEmpty()) return null;
    try {
      return objectMapper.writeValueAsString(sanitizedImageUrls);
    } catch (Exception e) {
      log.warn("👉 [에이전트 채팅] 이미지 URL JSON 직렬화 실패 message={}", e.getMessage());
      return null;
    }
  }

  private List<String> parseImageUrls(ChatMessage message) {
    if (message == null
        || message.getImageUrlsJson() == null
        || message.getImageUrlsJson().isBlank()) {
      return null;
    }
    try {
      List<String> parsed =
          objectMapper.readValue(
              message.getImageUrlsJson(),
              objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
      if (parsed == null || parsed.isEmpty()) return null;
      List<String> sanitizedImageUrls = new ArrayList<>();
      for (String imageUrl : parsed) {
        if (imageUrl == null) continue;
        String trimmedImageUrl = imageUrl.trim();
        if (trimmedImageUrl.isEmpty()) continue;
        sanitizedImageUrls.add(trimmedImageUrl);
      }
      return sanitizedImageUrls.isEmpty() ? null : sanitizedImageUrls;
    } catch (Exception e) {
      log.warn("👉 [에이전트 채팅] 이미지 URL JSON 역직렬화 실패 message={}", e.getMessage());
      return null;
    }
  }

  private String toProgressNotesJson(List<String> progressNotes) {
    if (progressNotes == null || progressNotes.isEmpty()) return null;
    List<String> sanitizedProgressNotes = new ArrayList<>();
    for (String progressNote : progressNotes) {
      if (progressNote == null) continue;
      String trimmedProgressNote = progressNote.trim();
      if (trimmedProgressNote.isEmpty()) continue;
      sanitizedProgressNotes.add(trimmedProgressNote);
    }
    if (sanitizedProgressNotes.isEmpty()) return null;
    try {
      return objectMapper.writeValueAsString(sanitizedProgressNotes);
    } catch (Exception e) {
      log.warn("👉 [에이전트 채팅] 진행 상태 JSON 직렬화 실패 message={}", e.getMessage());
      return null;
    }
  }

  private List<String> parseProgressNotes(ChatMessage message) {
    if (message == null
        || message.getProgressNotesJson() == null
        || message.getProgressNotesJson().isBlank()) {
      return null;
    }
    try {
      List<String> parsed =
          objectMapper.readValue(
              message.getProgressNotesJson(),
              objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
      if (parsed == null || parsed.isEmpty()) return null;
      List<String> sanitizedProgressNotes = new ArrayList<>();
      for (String progressNote : parsed) {
        if (progressNote == null) continue;
        String trimmedProgressNote = progressNote.trim();
        if (trimmedProgressNote.isEmpty()) continue;
        sanitizedProgressNotes.add(trimmedProgressNote);
      }
      return sanitizedProgressNotes.isEmpty() ? null : sanitizedProgressNotes;
    } catch (Exception e) {
      log.warn("👉 [에이전트 채팅] 진행 상태 JSON 역직렬화 실패 message={}", e.getMessage());
      return null;
    }
  }

  /** SUB는 스케줄러·오케스트레이션 전제상 반드시 단일 MAIN에 연결되어 있어야 한다. */
  private void assertSubAgentLinkedToMain(AgentRole agent) {
    if (agent.getRoleType() != AgentRoleType.SUB) {
      return;
    }
    if (agent.getMainAgent() == null) {
      throw new IllegalArgumentException("서브 에이전트에 메인이 연결되지 않았습니다. 에이전트 설정에서 메인을 지정한 뒤 다시 시도하세요.");
    }
  }
}
