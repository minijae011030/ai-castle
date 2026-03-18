package com.aicastle.backend.repository;

import com.aicastle.backend.entity.ChatMessage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

  List<ChatMessage> findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
      Long userAccountId, Long agentRoleId);

  Page<ChatMessage> findByUserAccount_IdAndAgentRole_IdOrderByIdDesc(
      Long userAccountId, Long agentRoleId, Pageable pageable);

  Page<ChatMessage> findByUserAccount_IdAndAgentRole_IdAndIdLessThanOrderByIdDesc(
      Long userAccountId, Long agentRoleId, Long beforeId, Pageable pageable);

  Optional<ChatMessage> findTop1ByUserAccount_IdAndAgentRole_IdOrderByIdAsc(
      Long userAccountId, Long agentRoleId);
}
