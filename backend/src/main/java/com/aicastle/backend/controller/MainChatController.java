package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.MainChatService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 메인 에이전트(김주영) 채팅 API 스켈레톤. */
@RestController
@RequestMapping("/api/chat/main")
public class MainChatController {

  private final MainChatService mainChatService;

  public MainChatController(MainChatService mainChatService) {
    this.mainChatService = mainChatService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<ChatMessageResponse>>> history() {
    Long userId = getUserId();
    List<ChatMessageResponse> data = mainChatService.getRecentMessages(userId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<ChatMessageResponse>> send(
      @Valid @RequestBody ChatSendRequest request) {
    Long userId = getUserId();
    ChatMessageResponse data = mainChatService.sendMessage(userId, request);
    return ResponseEntity.ok(ResultResponse.success("메시지가 전송되었습니다.", data));
  }
}
