package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.dto.TodoDtos.TodoCreateRequest;
import com.aicastle.backend.dto.TodoDtos.TodoResponse;
import com.aicastle.backend.dto.TodoDtos.TodoStatusUpdateRequest;
import com.aicastle.backend.dto.TodoDtos.TodoUpdateRequest;
import com.aicastle.backend.entity.TodoStatus;
import com.aicastle.backend.service.TodoService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Todo 목록/생성/업데이트/상태 변경 API. */
@RestController
@RequestMapping("/api/todos")
public class TodoController {

  private final TodoService todoService;

  public TodoController(TodoService todoService) {
    this.todoService = todoService;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<List<TodoResponse>>> listByDate(
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    Long userId = getUserId();
    List<TodoResponse> data = todoService.findByDate(userId, date);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @GetMapping("/status")
  public ResponseEntity<ResultResponse<List<TodoResponse>>> listByStatus(
      @RequestParam("status") TodoStatus status) {
    Long userId = getUserId();
    List<TodoResponse> data = todoService.findByStatus(userId, status);
    return ResponseEntity.ok(ResultResponse.success(data));
  }

  @PostMapping
  public ResponseEntity<ResultResponse<TodoResponse>> create(
      @Valid @RequestBody TodoCreateRequest request) {
    Long userId = getUserId();
    TodoResponse data = todoService.create(userId, request);
    return ResponseEntity.ok(ResultResponse.success("Todo가 생성되었습니다.", data));
  }

  @PutMapping("/{id}")
  public ResponseEntity<ResultResponse<TodoResponse>> update(
      @PathVariable Long id, @Valid @RequestBody TodoUpdateRequest request) {
    Long userId = getUserId();
    TodoResponse data = todoService.update(userId, id, request);
    return ResponseEntity.ok(ResultResponse.success("Todo가 수정되었습니다.", data));
  }

  @PutMapping("/{id}/status")
  public ResponseEntity<ResultResponse<TodoResponse>> updateStatus(
      @PathVariable Long id, @Valid @RequestBody TodoStatusUpdateRequest request) {
    Long userId = getUserId();
    TodoResponse data = todoService.updateStatus(userId, id, request);
    return ResponseEntity.ok(ResultResponse.success("Todo 상태가 변경되었습니다.", data));
  }
}
