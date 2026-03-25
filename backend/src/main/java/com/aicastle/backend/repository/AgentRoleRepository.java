package com.aicastle.backend.repository;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRoleRepository extends JpaRepository<AgentRole, Long> {

  List<AgentRole> findByRoleType(AgentRoleType roleType);

  List<AgentRole> findByRoleTypeOrderByNameAsc(AgentRoleType roleType);

  /** 메인에 매핑된 SUB만 (배치·캘린더 에이전트 선택용). */
  List<AgentRole> findByRoleTypeAndMainAgentIsNotNullOrderByNameAsc(AgentRoleType roleType);

  List<AgentRole> findByRoleTypeAndMainAgent_IdOrderByNameAsc(
      AgentRoleType roleType, Long mainAgentId);

  Optional<AgentRole> findByName(String name);
}
