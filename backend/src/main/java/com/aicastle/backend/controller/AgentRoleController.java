package com.aicastle.backend.controller;

import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleCreateRequest;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleResponse;
import com.aicastle.backend.dto.AgentRoleDtos.AgentRoleUpdateRequest;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.service.AgentRoleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** AgentRole(에이전트 역할) 관리 API. */
@RestController
@RequestMapping("/api/agents")
public class AgentRoleController {

  private final AgentRoleService agentRoleService;

  public AgentRoleController(AgentRoleService agentRoleService) {
    this.agentRoleService = agentRoleService;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<AgentRoleResponse>>> list() {
    List<AgentRoleResponse> data = agentRoleService.findAll();
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<AgentRoleResponse>> create(
      @Valid @RequestBody AgentRoleCreateRequest request) {
    AgentRoleResponse data = agentRoleService.create(request);
    return ResponseEntity.ok(ResultResponse.success("에이전트가 생성되었습니다.", data));
  }

  @PatchMapping("/{id}")
  public ResponseEntity<ResultResponse<AgentRoleResponse>> update(
      @PathVariable Long id, @Valid @RequestBody AgentRoleUpdateRequest request) {
    AgentRoleResponse data = agentRoleService.update(id, request);
    return ResponseEntity.ok(ResultResponse.success("에이전트가 수정되었습니다.", data));
  }
}
