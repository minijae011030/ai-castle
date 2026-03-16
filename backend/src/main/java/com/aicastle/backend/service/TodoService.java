package com.aicastle.backend.service;

import com.aicastle.backend.dto.TodoDtos.TodoCreateRequest;
import com.aicastle.backend.dto.TodoDtos.TodoResponse;
import com.aicastle.backend.dto.TodoDtos.TodoStatusUpdateRequest;
import com.aicastle.backend.dto.TodoDtos.TodoUpdateRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.Todo;
import com.aicastle.backend.entity.TodoStatus;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.TodoRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Todo CRUD 및 상태 변경 서비스. */
@Service
public class TodoService {

  private final TodoRepository todoRepository;
  private final UserAccountRepository userAccountRepository;
  private final AgentRoleRepository agentRoleRepository;

  public TodoService(
      TodoRepository todoRepository,
      UserAccountRepository userAccountRepository,
      AgentRoleRepository agentRoleRepository) {
    this.todoRepository = todoRepository;
    this.userAccountRepository = userAccountRepository;
    this.agentRoleRepository = agentRoleRepository;
  }

  @Transactional(readOnly = true)
  public List<TodoResponse> findByDate(Long userId, LocalDate date) {
    List<Todo> todos =
        todoRepository.findByUserAccountIdAndScheduledDateOrderByOrderIndexAsc(userId, date);
    return todos.stream().map(TodoResponse::fromEntity).collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public List<TodoResponse> findByStatus(Long userId, TodoStatus status) {
    List<Todo> todos = todoRepository.findByUserAccountIdAndStatus(userId, status);
    return todos.stream().map(TodoResponse::fromEntity).collect(Collectors.toList());
  }

  @Transactional
  public TodoResponse create(Long userId, TodoCreateRequest request) {
    if (request.agentRoleId() == null) {
      throw new IllegalArgumentException("에이전트 ID는 필수입니다.");
    }
    if (request.title() == null || request.title().isBlank()) {
      throw new IllegalArgumentException("Todo 제목은 비어 있을 수 없습니다.");
    }
    if (request.scheduledDate() == null) {
      throw new IllegalArgumentException("Todo 예정 날짜는 필수입니다.");
    }

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    AgentRole agentRole =
        agentRoleRepository
            .findById(request.agentRoleId())
            .orElseThrow(() -> new IllegalArgumentException("에이전트를 찾을 수 없습니다."));

    int orderIndex =
        request.orderIndex() != null
            ? request.orderIndex()
            : todoRepository
                    .findByUserAccountIdAndScheduledDateOrderByOrderIndexAsc(
                        userId, request.scheduledDate())
                    .size()
                + 1;

    Todo todo =
        new Todo(
            user,
            agentRole,
            request.title().trim(),
            request.description() != null ? request.description().trim() : "",
            request.scheduledDate(),
            orderIndex);

    Todo saved = todoRepository.save(todo);
    return TodoResponse.fromEntity(saved);
  }

  @Transactional
  public TodoResponse update(Long userId, Long todoId, TodoUpdateRequest request) {
    Todo todo =
        todoRepository
            .findById(todoId)
            .orElseThrow(() -> new IllegalArgumentException("Todo를 찾을 수 없습니다."));

    if (!todo.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 Todo만 수정할 수 있습니다.");
    }

    if (request.title() != null && !request.title().isBlank()) {
      todo.setTitle(request.title().trim());
    }
    if (request.description() != null) {
      todo.setDescription(request.description().trim());
    }
    if (request.scheduledDate() != null) {
      todo.setScheduledDate(request.scheduledDate());
    }
    if (request.orderIndex() != null) {
      todo.setOrderIndex(request.orderIndex());
    }
    if (request.status() != null) {
      todo.setStatus(request.status());
    }

    Todo saved = todoRepository.save(todo);
    return TodoResponse.fromEntity(saved);
  }

  @Transactional
  public TodoResponse updateStatus(Long userId, Long todoId, TodoStatusUpdateRequest request) {
    Todo todo =
        todoRepository
            .findById(todoId)
            .orElseThrow(() -> new IllegalArgumentException("Todo를 찾을 수 없습니다."));

    if (!todo.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 Todo만 수정할 수 있습니다.");
    }

    if (request.status() == null) {
      throw new IllegalArgumentException("상태는 필수입니다.");
    }

    todo.setStatus(request.status());
    Todo saved = todoRepository.save(todo);
    return TodoResponse.fromEntity(saved);
  }
}
