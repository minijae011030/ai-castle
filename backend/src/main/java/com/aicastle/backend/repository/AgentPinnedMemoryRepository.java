package com.aicastle.backend.repository;

import com.aicastle.backend.entity.AgentPinnedMemory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentPinnedMemoryRepository extends JpaRepository<AgentPinnedMemory, Long> {

  List<AgentPinnedMemory> findByUserAccount_IdAndAgentRole_IdOrderByCreatedAtAsc(
      Long userAccountId, Long agentRoleId);

  long countByUserAccount_IdAndAgentRole_Id(Long userAccountId, Long agentRoleId);
}
