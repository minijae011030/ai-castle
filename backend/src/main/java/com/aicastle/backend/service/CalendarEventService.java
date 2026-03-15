package com.aicastle.backend.service;

import com.aicastle.backend.dto.CalendarEventCreateRequest;
import com.aicastle.backend.dto.CalendarEventResponse;
import com.aicastle.backend.dto.CalendarEventUpdateRequest;
import com.aicastle.backend.entity.CalendarEvent;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.CalendarEventRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 캘린더 이벤트 CRUD. */
@Service
public class CalendarEventService {

  private final CalendarEventRepository calendarEventRepository;
  private final UserAccountRepository userAccountRepository;

  public CalendarEventService(
      CalendarEventRepository calendarEventRepository,
      UserAccountRepository userAccountRepository) {
    this.calendarEventRepository = calendarEventRepository;
    this.userAccountRepository = userAccountRepository;
  }

  @Transactional(readOnly = true)
  public List<CalendarEventResponse> findAllByUserId(Long userId) {
    List<CalendarEvent> events =
        calendarEventRepository.findByUserAccount_IdOrderByStartAtAsc(userId);
    return events.stream().map(this::toResponse).collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public CalendarEventResponse findByIdAndUserId(Long id, Long userId) {
    CalendarEvent event =
        calendarEventRepository
            .findByIdAndUserAccount_Id(id, userId)
            .orElseThrow(() -> new IllegalArgumentException("캘린더 이벤트를 찾을 수 없습니다."));
    return toResponse(event);
  }

  @Transactional
  public CalendarEventResponse create(Long userId, CalendarEventCreateRequest request) {
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    if (request.endAt().isBefore(request.startAt())) {
      throw new IllegalArgumentException("종료 시각은 시작 시각 이후여야 합니다.");
    }
    CalendarEvent event =
        new CalendarEvent(
            user,
            request.title(),
            request.startAt(),
            request.endAt(),
            request.memo() != null ? request.memo() : "");
    event = calendarEventRepository.save(event);
    return toResponse(event);
  }

  @Transactional
  public CalendarEventResponse update(Long id, Long userId, CalendarEventUpdateRequest request) {
    CalendarEvent event =
        calendarEventRepository
            .findByIdAndUserAccount_Id(id, userId)
            .orElseThrow(() -> new IllegalArgumentException("캘린더 이벤트를 찾을 수 없습니다."));
    if (request.title() != null) {
      event.setTitle(request.title());
    }
    if (request.startAt() != null) {
      event.setStartAt(request.startAt());
    }
    if (request.endAt() != null) {
      event.setEndAt(request.endAt());
    }
    if (request.memo() != null) {
      event.setMemo(request.memo());
    }
    if (event.getEndAt().isBefore(event.getStartAt())) {
      throw new IllegalArgumentException("종료 시각은 시작 시각 이후여야 합니다.");
    }
    event = calendarEventRepository.save(event);
    return toResponse(event);
  }

  @Transactional
  public void delete(Long id, Long userId) {
    if (!calendarEventRepository.existsByIdAndUserAccount_Id(id, userId)) {
      throw new IllegalArgumentException("캘린더 이벤트를 찾을 수 없습니다.");
    }
    calendarEventRepository.deleteById(id);
  }

  private CalendarEventResponse toResponse(CalendarEvent e) {
    return new CalendarEventResponse(
        e.getId(),
        e.getTitle(),
        e.getStartAt(),
        e.getEndAt(),
        e.getMemo(),
        e.getCreatedAt(),
        e.getUpdatedAt());
  }
}
