package com.aicastle.backend.dto;

import java.time.Instant;
import java.util.List;

public class AgentMemoryDtos {

  public record AgentPinnedMemoryResponse(Long id, String content, Instant createdAt) {}

  public record AgentPinnedMemoryListResponse(List<AgentPinnedMemoryResponse> items) {}

  public record AgentPinnedMemoryCreateRequest(String content) {}

  public record AgentPinnedMemoryUpdateRequest(String content) {}
}
