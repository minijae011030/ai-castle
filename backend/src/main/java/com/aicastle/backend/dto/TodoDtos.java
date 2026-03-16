package com.aicastle.backend.dto;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.Todo;
import com.aicastle.backend.entity.TodoStatus;
import java.time.LocalDate;

/** Todo 도메인용 DTO 모음. */
public class TodoDtos {

  public record TodoAgentSummary(Long id, String name) {}

  public record TodoResponse(
      Long id,
      String title,
      String description,
      TodoStatus status,
      LocalDate scheduledDate,
      int orderIndex,
      TodoAgentSummary agent) {

    public static TodoResponse fromEntity(Todo entity) {
      AgentRole agentRole = entity.getAgentRole();
      TodoAgentSummary agentSummary = new TodoAgentSummary(agentRole.getId(), agentRole.getName());

      return new TodoResponse(
          entity.getId(),
          entity.getTitle(),
          entity.getDescription(),
          entity.getStatus(),
          entity.getScheduledDate(),
          entity.getOrderIndex(),
          agentSummary);
    }
  }

  public record TodoCreateRequest(
      Long agentRoleId,
      String title,
      String description,
      LocalDate scheduledDate,
      Integer orderIndex) {}

  public record TodoUpdateRequest(
      String title,
      String description,
      LocalDate scheduledDate,
      Integer orderIndex,
      TodoStatus status) {}

  public record TodoStatusUpdateRequest(TodoStatus status) {}
}
