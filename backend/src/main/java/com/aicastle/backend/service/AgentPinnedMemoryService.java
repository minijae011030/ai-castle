package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryCreateRequest;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryListResponse;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryResponse;
import com.aicastle.backend.dto.AgentMemoryDtos.AgentPinnedMemoryUpdateRequest;
import com.aicastle.backend.entity.AgentPinnedMemory;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.AgentPinnedMemoryRepository;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentPinnedMemoryService {

  private static final int MAX_PINNED_MEMORY_COUNT = 10;

  private final AgentPinnedMemoryRepository agentPinnedMemoryRepository;
  private final AgentRoleRepository agentRoleRepository;
  private final UserAccountRepository userAccountRepository;

  public AgentPinnedMemoryService(
      AgentPinnedMemoryRepository agentPinnedMemoryRepository,
      AgentRoleRepository agentRoleRepository,
      UserAccountRepository userAccountRepository) {
    this.agentPinnedMemoryRepository = agentPinnedMemoryRepository;
    this.agentRoleRepository = agentRoleRepository;
    this.userAccountRepository = userAccountRepository;
  }

  @Transactional(readOnly = true)
  public AgentPinnedMemoryListResponse list(Long userId, Long agentId) {
    List<AgentPinnedMemory> items =
        agentPinnedMemoryRepository.findByUserAccount_IdAndAgentRole_IdOrderByCreatedAtAsc(
            userId, agentId);
    return new AgentPinnedMemoryListResponse(items.stream().map(this::toResponse).toList());
  }

  @Transactional
  public AgentPinnedMemoryResponse create(
      Long userId, Long agentId, AgentPinnedMemoryCreateRequest request) {
    String content = request == null || request.content() == null ? "" : request.content().trim();
    if (content.isBlank()) {
      throw new IllegalArgumentException("메모리 내용은 비어 있을 수 없습니다.");
    }
    if (content.length() > 2000) {
      throw new IllegalArgumentException("메모리 내용은 2000자를 초과할 수 없습니다.");
    }

    long count = agentPinnedMemoryRepository.countByUserAccount_IdAndAgentRole_Id(userId, agentId);
    if (count >= MAX_PINNED_MEMORY_COUNT) {
      throw new IllegalArgumentException("고정 메모리는 최대 10개까지 저장할 수 있습니다. 기존 항목을 삭제해 주세요.");
    }

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    AgentRole agent =
        agentRoleRepository
            .findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    AgentPinnedMemory saved =
        agentPinnedMemoryRepository.save(new AgentPinnedMemory(user, agent, content));
    return toResponse(saved);
  }

  @Transactional
  public void delete(Long userId, Long agentId, Long memoryId) {
    AgentPinnedMemory memory =
        agentPinnedMemoryRepository
            .findById(memoryId)
            .orElseThrow(() -> new IllegalArgumentException("메모리를 찾을 수 없습니다."));

    if (memory.getUserAccount() == null
        || memory.getUserAccount().getId() == null
        || !memory.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 메모리만 삭제할 수 있습니다.");
    }
    if (memory.getAgentRole() == null
        || memory.getAgentRole().getId() == null
        || !memory.getAgentRole().getId().equals(agentId)) {
      throw new IllegalArgumentException("잘못된 에이전트 메모리입니다.");
    }

    agentPinnedMemoryRepository.delete(memory);
  }

  @Transactional
  public AgentPinnedMemoryResponse update(
      Long userId, Long agentId, Long memoryId, AgentPinnedMemoryUpdateRequest request) {
    String content = request == null || request.content() == null ? "" : request.content().trim();
    if (content.isBlank()) {
      throw new IllegalArgumentException("메모리 내용은 비어 있을 수 없습니다.");
    }
    if (content.length() > 2000) {
      throw new IllegalArgumentException("메모리 내용은 2000자를 초과할 수 없습니다.");
    }

    AgentPinnedMemory memory =
        agentPinnedMemoryRepository
            .findById(memoryId)
            .orElseThrow(() -> new IllegalArgumentException("메모리를 찾을 수 없습니다."));

    if (memory.getUserAccount() == null
        || memory.getUserAccount().getId() == null
        || !memory.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 메모리만 수정할 수 있습니다.");
    }
    if (memory.getAgentRole() == null
        || memory.getAgentRole().getId() == null
        || !memory.getAgentRole().getId().equals(agentId)) {
      throw new IllegalArgumentException("잘못된 에이전트 메모리입니다.");
    }

    memory.setContent(content);
    return toResponse(memory);
  }

  private AgentPinnedMemoryResponse toResponse(AgentPinnedMemory memory) {
    Instant createdAt =
        memory.getCreatedAt() == null
            ? Instant.now()
            : memory.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant();
    return new AgentPinnedMemoryResponse(memory.getId(), memory.getContent(), createdAt);
  }
}
