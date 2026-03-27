package com.aicastle.backend.service;

import com.aicastle.backend.dto.RecurringScheduleTemplateDtos.RecurringScheduleTemplateCreateRequest;
import com.aicastle.backend.dto.RecurringScheduleTemplateDtos.RecurringScheduleTemplateResponse;
import com.aicastle.backend.entity.RecurringScheduleTemplate;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.RecurringScheduleTemplateRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 정기 일정 템플릿 서비스. */
@Service
public class RecurringScheduleTemplateService {

  private final RecurringScheduleTemplateRepository recurringScheduleTemplateRepository;
  private final UserAccountRepository userAccountRepository;

  public RecurringScheduleTemplateService(
      RecurringScheduleTemplateRepository recurringScheduleTemplateRepository,
      UserAccountRepository userAccountRepository) {
    this.recurringScheduleTemplateRepository = recurringScheduleTemplateRepository;
    this.userAccountRepository = userAccountRepository;
  }

  @Transactional(readOnly = true)
  public List<RecurringScheduleTemplateResponse> findAllByUserId(Long userId) {
    List<RecurringScheduleTemplate> list =
        recurringScheduleTemplateRepository.findByUserAccount_Id(userId);
    return list.stream()
        .map(RecurringScheduleTemplateResponse::fromEntity)
        .collect(Collectors.toList());
  }

  @Transactional
  public RecurringScheduleTemplateResponse create(
      Long userId, RecurringScheduleTemplateCreateRequest req) {
    if (req.title() == null || req.title().isBlank()) {
      throw new IllegalArgumentException("제목은 비어 있을 수 없습니다.");
    }
    LocalDate start = req.periodStartDate();
    LocalDate end = req.periodEndDate();
    if (start == null || end == null) {
      throw new IllegalArgumentException("반복 시작/종료일은 필수입니다.");
    }
    if (end.isBefore(start)) {
      throw new IllegalArgumentException("반복 종료일은 시작일 이후여야 합니다.");
    }
    String weekdays = req.repeatWeekdays();
    if (weekdays == null || weekdays.isBlank()) {
      throw new IllegalArgumentException("반복 요일은 최소 1개 이상이어야 합니다.");
    }
    LocalTime startTime = req.startTime();
    LocalTime endTime = req.endTime();
    if (startTime == null || endTime == null || !endTime.isAfter(startTime)) {
      throw new IllegalArgumentException("종료 시각은 시작 시각 이후여야 합니다.");
    }

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    RecurringScheduleTemplate template =
        new RecurringScheduleTemplate(
            user,
            req.title().trim(),
            req.description() != null ? req.description().trim() : null,
            req.category() != null && !req.category().trim().isBlank()
                ? req.category().trim()
                : null,
            start,
            end,
            weekdays,
            startTime,
            endTime);

    RecurringScheduleTemplate saved = recurringScheduleTemplateRepository.save(template);
    return RecurringScheduleTemplateResponse.fromEntity(saved);
  }
}
