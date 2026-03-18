package com.aicastle.backend.repository;

import com.aicastle.backend.entity.ChatMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

  List<ChatMessage> findTop50ByUserAccount_IdAndAgentRole_IdOrderByCreatedAtDesc(
      Long userAccountId, Long agentRoleId);
}
