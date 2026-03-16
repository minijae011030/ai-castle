package com.aicastle.backend.dto;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;

/** AgentRole 도메인용 DTO 모음. */
public class AgentRoleDtos {

  public record AgentRoleResponse(
      Long id, String name, AgentRoleType roleType, String systemPrompt) {

    public static AgentRoleResponse fromEntity(AgentRole entity) {
      return new AgentRoleResponse(
          entity.getId(), entity.getName(), entity.getRoleType(), entity.getSystemPrompt());
    }
  }

  public record AgentRoleCreateRequest(String name, AgentRoleType roleType, String systemPrompt) {}

  public record AgentRoleUpdateRequest(String systemPrompt) {}
}
