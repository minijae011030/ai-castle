package com.aicastle.backend.repository;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRoleRepository extends JpaRepository<AgentRole, Long> {

  List<AgentRole> findByRoleType(AgentRoleType roleType);

  Optional<AgentRole> findByName(String name);
}
