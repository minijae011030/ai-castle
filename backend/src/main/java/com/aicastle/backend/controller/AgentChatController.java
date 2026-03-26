package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ChatDtos.ChatHistoryPageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.AgentChatService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

/** 서브 에이전트 채팅 API 스켈레톤. */
@RestController
@RequestMapping("/api/chat/agents")
public class AgentChatController {

  private final AgentChatService agentChatService;

  public AgentChatController(AgentChatService agentChatService) {
    this.agentChatService = agentChatService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping("/{agentId}")
  public ResponseEntity<ResultResponse<ChatHistoryPageResponse>> history(
      @PathVariable Long agentId,
      @RequestParam(required = false) Long beforeId,
      @RequestParam(defaultValue = "30") int limit) {
    Long userId = getUserId();
    ChatHistoryPageResponse data =
        agentChatService.getMessagesPage(userId, agentId, beforeId, limit);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping("/{agentId}")
  public ResponseEntity<ResultResponse<ChatMessageResponse>> send(
      @PathVariable Long agentId, @Valid @RequestBody ChatSendRequest request) {
    Long userId = getUserId();
    ChatMessageResponse data = agentChatService.sendMessage(userId, agentId, request);
    return ResponseEntity.ok(ResultResponse.success("메시지가 전송되었습니다.", data));
  }

  /**
   * 스트리밍 전송 (NDJSON).
   *
   * <p>프론트에서 fetch ReadableStream으로 한 글자씩/한 줄씩 출력하기 위한 엔드포인트.
   */
  @PostMapping(value = "/{agentId}/stream", produces = "application/x-ndjson")
  public ResponseBodyEmitter sendStream(
      @PathVariable Long agentId, @Valid @RequestBody ChatSendRequest request) throws IOException {
    Long userId = getUserId();
    ResponseBodyEmitter emitter = new ResponseBodyEmitter(120_000L);
    // 반드시 비동기로 실행해야 응답이 즉시 열리고 delta가 실시간으로 흘러간다.
    CompletableFuture.runAsync(
        () -> {
          try {
            agentChatService.sendMessageStreamNdjson(userId, agentId, request, emitter);
          } catch (Exception e) {
            emitter.completeWithError(e);
          }
        });
    return emitter;
  }
}
