package com.aicastle.backend.service;

import com.aicastle.backend.dto.RecurringScheduleCreateRequest;
import com.aicastle.backend.dto.RecurringScheduleResponse;
import com.aicastle.backend.entity.RecurringSchedule;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.RecurringScheduleRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 정기 일정(반복 스케줄) CRUD. */
@Service
public class RecurringScheduleService {

  private final RecurringScheduleRepository recurringScheduleRepository;
  private final UserAccountRepository userAccountRepository;

  public RecurringScheduleService(
      RecurringScheduleRepository recurringScheduleRepository,
      UserAccountRepository userAccountRepository) {
    this.recurringScheduleRepository = recurringScheduleRepository;
    this.userAccountRepository = userAccountRepository;
  }

  @Transactional(readOnly = true)
  public List<RecurringScheduleResponse> findAllByUserId(Long userId) {
    List<RecurringSchedule> schedules =
        recurringScheduleRepository.findByUserAccount_IdOrderByPeriodStartAsc(userId);
    return schedules.stream().map(this::toResponse).collect(Collectors.toList());
  }

  @Transactional
  public RecurringScheduleResponse create(Long userId, RecurringScheduleCreateRequest request) {
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    LocalDate start = request.periodStart();
    LocalDate end = request.periodEnd();
    if (end.isBefore(start)) {
      throw new IllegalArgumentException("반복 종료일은 시작일 이후여야 합니다.");
    }

    LocalTime startTime = request.startTime();
    LocalTime endTime = request.endTime();
    if (!endTime.isAfter(startTime)) {
      throw new IllegalArgumentException("종료 시간은 시작 시간 이후여야 합니다.");
    }

    if (request.weekdays().isBlank()) {
      throw new IllegalArgumentException("요일은 최소 1개 이상이어야 합니다.");
    }

    RecurringSchedule schedule =
        new RecurringSchedule(
            user,
            request.title(),
            start,
            end,
            request.weekdays(),
            startTime,
            endTime,
            request.memo() != null ? request.memo() : "");

    schedule = recurringScheduleRepository.save(schedule);
    return toResponse(schedule);
  }

  private RecurringScheduleResponse toResponse(RecurringSchedule e) {
    return new RecurringScheduleResponse(
        e.getId(),
        e.getTitle(),
        e.getPeriodStart(),
        e.getPeriodEnd(),
        e.getWeekdays(),
        e.getStartTime(),
        e.getEndTime(),
        e.getMemo());
  }
}
