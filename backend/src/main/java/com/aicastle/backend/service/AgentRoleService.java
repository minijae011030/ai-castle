package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentRoleDtos.ActiveAgentResponse;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleCreateRequest;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleResponse;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleUpdateRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
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

  @Transactional(readOnly = true)
  public List<ActiveAgentResponse> findActiveAgents() {
    // 배치·일정 할당: 메인에 연결된 SUB만 노출 (미연결 SUB는 제외)
    return agentRoleRepository
        .findByRoleTypeAndMainAgentIsNotNullOrderByNameAsc(AgentRoleType.SUB)
        .stream()
        .map(ActiveAgentResponse::fromEntity)
        .collect(Collectors.toList());
  }

  /** 메인 에이전트 목록 (배치 그룹 헤드). */
  @Transactional(readOnly = true)
  public List<AgentRoleResponse> findMainAgents() {
    return agentRoleRepository.findByRoleTypeOrderByNameAsc(AgentRoleType.MAIN).stream()
        .map(AgentRoleResponse::fromEntity)
        .collect(Collectors.toList());
  }

  /** 특정 메인에 매핑된 SUB 목록 (스케줄러·오케스트레이션에서 병렬 호출 대상). */
  @Transactional(readOnly = true)
  public List<AgentRoleResponse> findSubAgentsByMainAgentId(Long mainAgentId) {
    AgentRole main =
        agentRoleRepository
            .findById(mainAgentId)
            .orElseThrow(() -> new IllegalArgumentException("메인 에이전트를 찾을 수 없습니다."));
    if (main.getRoleType() != AgentRoleType.MAIN) {
      throw new IllegalArgumentException("지정한 에이전트는 MAIN 타입이 아닙니다.");
    }
    return agentRoleRepository
        .findByRoleTypeAndMainAgent_IdOrderByNameAsc(AgentRoleType.SUB, mainAgentId)
        .stream()
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

    AgentRole mainAgent = resolveMainAgentForCreate(request.roleType(), request.mainAgentId());
    AgentRole entity =
        new AgentRole(request.name(), request.roleType(), request.systemPrompt().trim(), mainAgent);
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
    // SUB는 메인 에이전트 1개가 필수, MAIN은 메인 에이전트 지정 불가
    AgentRole mainAgent = resolveMainAgentForUpdate(entity, request.mainAgentId());
    entity.setMainAgent(mainAgent);

    AgentRole saved = agentRoleRepository.save(entity);
    return AgentRoleResponse.fromEntity(saved);
  }

  private AgentRole resolveMainAgentForCreate(AgentRoleType roleType, Long mainAgentId) {
    if (roleType == AgentRoleType.MAIN) {
      if (mainAgentId != null) {
        throw new IllegalArgumentException("메인 에이전트는 mainAgentId를 지정할 수 없습니다.");
      }
      return null;
    }
    if (mainAgentId == null) {
      throw new IllegalArgumentException("서브 에이전트는 mainAgentId가 필수입니다.");
    }
    AgentRole mainAgent =
        agentRoleRepository
            .findById(mainAgentId)
            .orElseThrow(() -> new IllegalArgumentException("지정한 메인 에이전트를 찾을 수 없습니다."));
    if (mainAgent.getRoleType() != AgentRoleType.MAIN) {
      throw new IllegalArgumentException("서브 에이전트는 MAIN 타입 에이전트에만 연결할 수 있습니다.");
    }
    return mainAgent;
  }

  private AgentRole resolveMainAgentForUpdate(AgentRole entity, Long requestedMainAgentId) {
    if (entity.getRoleType() == AgentRoleType.MAIN) {
      if (requestedMainAgentId != null) {
        throw new IllegalArgumentException("메인 에이전트는 mainAgentId를 지정할 수 없습니다.");
      }
      return null;
    }

    Long nextMainAgentId =
        requestedMainAgentId != null
            ? requestedMainAgentId
            : (entity.getMainAgent() == null ? null : entity.getMainAgent().getId());
    if (nextMainAgentId == null) {
      throw new IllegalArgumentException("서브 에이전트는 mainAgentId가 필수입니다.");
    }
    if (entity.getId() != null && entity.getId().equals(nextMainAgentId)) {
      throw new IllegalArgumentException("자기 자신을 메인 에이전트로 지정할 수 없습니다.");
    }

    AgentRole mainAgent =
        agentRoleRepository
            .findById(nextMainAgentId)
            .orElseThrow(() -> new IllegalArgumentException("지정한 메인 에이전트를 찾을 수 없습니다."));
    if (mainAgent.getRoleType() != AgentRoleType.MAIN) {
      throw new IllegalArgumentException("서브 에이전트는 MAIN 타입 에이전트에만 연결할 수 있습니다.");
    }
    return mainAgent;
  }
}
