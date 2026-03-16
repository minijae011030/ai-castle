package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleCreateRequest;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleResponse;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleUpdateRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.repository.AgentRoleRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** AgentRole 조회/등록/수정 서비스. */
@Service
public class AgentRoleService {

  private final AgentRoleRepository agentRoleRepository;

  public AgentRoleService(AgentRoleRepository agentRoleRepository) {
    this.agentRoleRepository = agentRoleRepository;
  }

  @Transactional(readOnly = true)
  public List<AgentRoleResponse> findAll() {
    return agentRoleRepository.findAll().stream()
        .map(AgentRoleResponse::fromEntity)
        .collect(Collectors.toList());
  }

  @Transactional
  public AgentRoleResponse create(AgentRoleCreateRequest request) {
    if (request.name() == null || request.name().isBlank()) {
      throw new IllegalArgumentException("에이전트 이름은 비어 있을 수 없습니다.");
    }
    if (request.roleType() == null) {
      throw new IllegalArgumentException("에이전트 타입은 필수입니다.");
    }
    if (request.systemPrompt() == null || request.systemPrompt().isBlank()) {
      throw new IllegalArgumentException("시스템 프롬프트는 비어 있을 수 없습니다.");
    }

    agentRoleRepository
        .findByName(request.name())
        .ifPresent(
            existing -> {
              throw new IllegalArgumentException("이미 존재하는 에이전트 이름입니다.");
            });

    AgentRole entity =
        new AgentRole(request.name(), request.roleType(), request.systemPrompt().trim());
    AgentRole saved = agentRoleRepository.save(entity);
    return AgentRoleResponse.fromEntity(saved);
  }

  @Transactional
  public AgentRoleResponse update(Long id, AgentRoleUpdateRequest request) {
    AgentRole entity =
        agentRoleRepository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
      entity.setSystemPrompt(request.systemPrompt().trim());
    }

    AgentRole saved = agentRoleRepository.save(entity);
    return AgentRoleResponse.fromEntity(saved);
  }
}
