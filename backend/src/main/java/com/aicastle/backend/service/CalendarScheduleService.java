package com.aicastle.backend.service;

import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleCreateRequest;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleOccurrenceResponse;
import com.aicastle.backend.dto.ScheduleOccurrenceDtos.ScheduleUpdateRequest;
import com.aicastle.backend.entity.RecurringScheduleTemplate;
import com.aicastle.backend.entity.ScheduleOccurrence;
import com.aicastle.backend.entity.ScheduleOccurrence.ScheduleType;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.RecurringScheduleTemplateRepository;
import com.aicastle.backend.repository.ScheduleOccurrenceRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 캘린더 스케줄 조회/생성을 담당하는 서비스. */
@Service
public class CalendarScheduleService {

  private final ScheduleOccurrenceRepository occurrenceRepository;
  private final UserAccountRepository userAccountRepository;
  private final RecurringScheduleTemplateRepository recurringScheduleTemplateRepository;

  public CalendarScheduleService(
      ScheduleOccurrenceRepository occurrenceRepository,
      UserAccountRepository userAccountRepository,
      RecurringScheduleTemplateRepository recurringScheduleTemplateRepository) {
    this.occurrenceRepository = occurrenceRepository;
    this.userAccountRepository = userAccountRepository;
    this.recurringScheduleTemplateRepository = recurringScheduleTemplateRepository;
  }

  @Transactional(readOnly = true)
  public List<ScheduleOccurrenceResponse> getSchedulesByDay(Long userId, LocalDate date) {
    List<ScheduleOccurrence> list =
        occurrenceRepository.findByUserAccount_IdAndOccurrenceDateOrderByStartAtAsc(userId, date);
    return list.stream().map(ScheduleOccurrenceResponse::fromEntity).collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public List<ScheduleOccurrenceResponse> getSchedulesByMonth(Long userId, int year, int month) {
    YearMonth ym = YearMonth.of(year, month);
    LocalDate start = ym.atDay(1);
    LocalDate end = ym.atEndOfMonth();
    List<ScheduleOccurrence> list = occurrenceRepository.findByUserAndMonth(userId, start, end);
    return list.stream().map(ScheduleOccurrenceResponse::fromEntity).collect(Collectors.toList());
  }

  @Transactional
  public ScheduleOccurrenceResponse toggleDone(Long userId, Long occurrenceId) {
    ScheduleOccurrence occurrence =
        occurrenceRepository
            .findById(occurrenceId)
            .orElseThrow(() -> new IllegalArgumentException("스케줄을 찾을 수 없습니다."));

    if (!occurrence.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 스케줄만 변경할 수 있습니다.");
    }

    occurrence.setDone(!occurrence.isDone());
    ScheduleOccurrence saved = occurrenceRepository.save(occurrence);
    return ScheduleOccurrenceResponse.fromEntity(saved);
  }

  @Transactional
  public ScheduleOccurrenceResponse toggleRecurringTemplateOccurrence(
      Long userId, Long templateId, LocalDate date) {
    if (templateId == null || date == null) {
      throw new IllegalArgumentException("templateId와 date는 필수입니다.");
    }

    // 기존에 생성된 occurrence 가 있으면 토글
    return occurrenceRepository
        .findByUserAccount_IdAndTypeAndRecurringTemplateIdAndOccurrenceDate(
            userId, ScheduleType.RECURRING_OCCURRENCE, templateId, date)
        .map(
            existing -> {
              existing.setDone(!existing.isDone());
              ScheduleOccurrence saved = occurrenceRepository.save(existing);
              return ScheduleOccurrenceResponse.fromEntity(saved);
            })
        // 없으면 템플릿 정보를 기반으로 새 occurrence 를 생성하면서 done=true 로 설정
        .orElseGet(
            () -> {
              UserAccount user =
                  userAccountRepository
                      .findById(userId)
                      .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

              RecurringScheduleTemplate template =
                  recurringScheduleTemplateRepository
                      .findById(templateId)
                      .orElseThrow(() -> new IllegalArgumentException("정기 일정을 찾을 수 없습니다."));

              if (!template.getUserAccount().getId().equals(userId)) {
                throw new IllegalArgumentException("본인의 정기 일정만 변경할 수 있습니다.");
              }

              LocalDateTime startAt = LocalDateTime.of(date, template.getStartTime());
              LocalDateTime endAt = LocalDateTime.of(date, template.getEndTime());

              ScheduleOccurrence occurrence =
                  new ScheduleOccurrence(
                      user,
                      ScheduleType.RECURRING_OCCURRENCE,
                      template.getTitle(),
                      template.getDescription(),
                      date,
                      startAt,
                      endAt);
              occurrence.setRecurringTemplateId(templateId);
              occurrence.setDone(true);

              ScheduleOccurrence saved = occurrenceRepository.save(occurrence);
              return ScheduleOccurrenceResponse.fromEntity(saved);
            });
  }

  @Transactional
  public ScheduleOccurrenceResponse create(Long userId, ScheduleCreateRequest request) {
    if (request.type() == null) {
      throw new IllegalArgumentException("type 은 필수입니다.");
    }
    if (request.title() == null || request.title().isBlank()) {
      throw new IllegalArgumentException("제목은 비어 있을 수 없습니다.");
    }
    if (request.occurrenceDate() == null) {
      throw new IllegalArgumentException("occurrenceDate 는 필수입니다.");
    }
    if (request.startAt() == null || request.endAt() == null) {
      throw new IllegalArgumentException("startAt / endAt 은 필수입니다.");
    }
    if (!request.endAt().isAfter(request.startAt())) {
      throw new IllegalArgumentException("endAt 은 startAt 이후여야 합니다.");
    }

    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    ScheduleOccurrence occurrence =
        new ScheduleOccurrence(
            user,
            request.type(),
            request.title().trim(),
            request.description() != null ? request.description().trim() : null,
            request.occurrenceDate(),
            request.startAt(),
            request.endAt());

    if (request.type() == ScheduleType.RECURRING_OCCURRENCE) {
      occurrence.setRecurringTemplateId(request.recurringTemplateId());
    }

    ScheduleOccurrence saved = occurrenceRepository.save(occurrence);
    return ScheduleOccurrenceResponse.fromEntity(saved);
  }

  @Transactional
  public ScheduleOccurrenceResponse update(
      Long userId, Long occurrenceId, ScheduleUpdateRequest request) {
    ScheduleOccurrence occurrence =
        occurrenceRepository
            .findById(occurrenceId)
            .orElseThrow(() -> new IllegalArgumentException("스케줄을 찾을 수 없습니다."));

    if (!occurrence.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 스케줄만 수정할 수 있습니다.");
    }

    if (request.title() != null && !request.title().isBlank()) {
      occurrence.setTitle(request.title().trim());
    }
    if (request.description() != null) {
      occurrence.setDescription(request.description().trim());
    }
    LocalDateTime startAt = request.startAt() != null ? request.startAt() : occurrence.getStartAt();
    LocalDateTime endAt = request.endAt() != null ? request.endAt() : occurrence.getEndAt();
    if (!endAt.isAfter(startAt)) {
      throw new IllegalArgumentException("endAt 은 startAt 이후여야 합니다.");
    }
    occurrence.setStartAt(startAt);
    occurrence.setEndAt(endAt);

    if (request.done() != null) {
      occurrence.setDone(request.done());
    }

    ScheduleOccurrence saved = occurrenceRepository.save(occurrence);
    return ScheduleOccurrenceResponse.fromEntity(saved);
  }

  @Transactional
  public void delete(Long userId, Long occurrenceId) {
    ScheduleOccurrence occurrence =
        occurrenceRepository
            .findById(occurrenceId)
            .orElseThrow(() -> new IllegalArgumentException("스케줄을 찾을 수 없습니다."));

    if (!occurrence.getUserAccount().getId().equals(userId)) {
      throw new IllegalArgumentException("본인의 스케줄만 삭제할 수 있습니다.");
    }

    occurrenceRepository.delete(occurrence);
  }
}
