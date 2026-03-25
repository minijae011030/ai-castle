package com.aicastle.backend.dto;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;

/** AgentRole 도메인용 DTO 모음. */
public class AgentRoleDtos {

  public record AgentRoleResponse(
      Long id, String name, AgentRoleType roleType, String systemPrompt, Long mainAgentId) {

    public static AgentRoleResponse fromEntity(AgentRole entity) {
      return new AgentRoleResponse(
          entity.getId(),
          entity.getName(),
          entity.getRoleType(),
          entity.getSystemPrompt(),
          entity.getMainAgent() == null ? null : entity.getMainAgent().getId());
    }
  }

  public record AgentRoleCreateRequest(
      String name, AgentRoleType roleType, String systemPrompt, Long mainAgentId) {}

  public record AgentRoleUpdateRequest(String systemPrompt, Long mainAgentId) {}

  /** UI/배치용 활성 서브 목록. {@code mainAgentId}는 SUB가 속한 메인(오케스트레이션 그룹 키). */
  public record ActiveAgentResponse(Long id, String name, Long mainAgentId) {

    public static ActiveAgentResponse fromEntity(AgentRole entity) {
      Long mainId = entity.getMainAgent() == null ? null : entity.getMainAgent().getId();
      return new ActiveAgentResponse(entity.getId(), entity.getName(), mainId);
    }
  }
}
