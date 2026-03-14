package com.aicastle.backend.repository;

import com.aicastle.backend.entity.Todo;
import com.aicastle.backend.entity.TodoStatus;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, Long> {

  List<Todo> findByUserAccountIdAndScheduledDateOrderByOrderIndexAsc(
      Long userAccountId, LocalDate scheduledDate);

  List<Todo> findByUserAccountIdAndStatus(Long userAccountId, TodoStatus status);
}
