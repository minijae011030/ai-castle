package com.aicastle.backend.controller;

import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryCreateRequest;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryListResponse;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryResponse;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryUpdateRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.AgentPinnedMemoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents/{agentId}/memory")
public class AgentPinnedMemoryController {

  private final AgentPinnedMemoryService agentPinnedMemoryService;

  public AgentPinnedMemoryController(AgentPinnedMemoryService agentPinnedMemoryService) {
    this.agentPinnedMemoryService = agentPinnedMemoryService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<AgentPinnedMemoryListResponse>> list(
      @PathVariable Long agentId) {
    Long userId = getUserId();
    AgentPinnedMemoryListResponse data = agentPinnedMemoryService.list(userId, agentId);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<AgentPinnedMemoryResponse>> create(
      @PathVariable Long agentId, @Valid @RequestBody AgentPinnedMemoryCreateRequest request) {
    Long userId = getUserId();
    AgentPinnedMemoryResponse data = agentPinnedMemoryService.create(userId, agentId, request);
    return ResponseEntity.ok(ResultResponse.success("메모리가 저장되었습니다.", data));
  }

  @DeleteMapping("/{memoryId}")
  public ResponseEntity<ResultResponse<Void>> delete(
      @PathVariable Long agentId, @PathVariable Long memoryId) {
    Long userId = getUserId();
    agentPinnedMemoryService.delete(userId, agentId, memoryId);
    return ResponseEntity.ok(ResultResponse.success("메모리가 삭제되었습니다.", null));
  }

  @PatchMapping("/{memoryId}")
  public ResponseEntity<ResultResponse<AgentPinnedMemoryResponse>> update(
      @PathVariable Long agentId,
      @PathVariable Long memoryId,
      @Valid @RequestBody AgentPinnedMemoryUpdateRequest request) {
    Long userId = getUserId();
    AgentPinnedMemoryResponse data =
        agentPinnedMemoryService.update(userId, agentId, memoryId, request);
    return ResponseEntity.ok(ResultResponse.success("메모리가 수정되었습니다.", data));
  }
}
