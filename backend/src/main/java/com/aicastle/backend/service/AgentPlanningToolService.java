package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentPlanningToolDtos.ApplyMode;
import com.aicastle.backend.dto.AgentPlanningToolDtos.CalendarEventItem;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleApplyRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleApplyResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleExplainRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ReschedulePlanItem;
import com.aicastle.backend.dto.AgentPlanningToolDtos.ReschedulePlanResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleRollbackRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleRollbackResponse;
import com.aicastle.backend.dto.AgentPlanningToolDtos.RescheduleSimulateRequest;
import com.aicastle.backend.dto.AgentPlanningToolDtos.TodoItem;
import com.aicastle.backend.dto.AgentPlanningToolDtos.UserConstraintResponse;
import com.aicastle.backend.entity.RecurringScheduleTemplate;
import com.aicastle.backend.entity.ScheduleOccurrence;
import com.aicastle.backend.entity.ScheduleOccurrence.ScheduleType;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.RecurringScheduleTemplateRepository;
import com.aicastle.backend.repository.ScheduleOccurrenceRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 에이전트가 일정 재조정을 자동 수행할 수 있도록 툴셋 액션을 제공한다. */
@Service
public class AgentPlanningToolService {

  private static final Logger log = LoggerFactory.getLogger(AgentPlanningToolService.class);

  private final ScheduleOccurrenceRepository scheduleOccurrenceRepository;
  private final UserAccountRepository userAccountRepository;
  private final RecurringScheduleTemplateRepository recurringScheduleTemplateRepository;

  public AgentPlanningToolService(
      ScheduleOccurrenceRepository scheduleOccurrenceRepository,
      UserAccountRepository userAccountRepository,
      RecurringScheduleTemplateRepository recurringScheduleTemplateRepository) {
    this.scheduleOccurrenceRepository = scheduleOccurrenceRepository;
    this.userAccountRepository = userAccountRepository;
    this.recurringScheduleTemplateRepository = recurringScheduleTemplateRepository;
  }

  @Transactional(readOnly = true)
  public List<CalendarEventItem> getCalendarEvents(
      Long userId, LocalDate startDate, LocalDate endDate) {
    validateDateRange(startDate, endDate);
    log.info("❤️ [TOOL:get_calendar_events] userId={}, range={}~{}", userId, startDate, endDate);
    List<ScheduleOccurrence> all =
        scheduleOccurrenceRepository.findByUserAndDateRange(userId, startDate, endDate);
    List<CalendarEventItem> events = new ArrayList<>();
    for (ScheduleOccurrence occurrence : all) {
      if (occurrence.getType() == ScheduleType.TODO) continue;
      events.add(
          new CalendarEventItem(
              occurrence.getId(),
              occurrence.getTitle(),
              occurrence.getDescription(),
              occurrence.getOccurrenceDate(),
              occurrence.getStartAt(),
              occurrence.getEndAt()));
    }
    events.addAll(expandRecurringTemplateEvents(userId, startDate, endDate));
    events.sort(
        Comparator.comparing(CalendarEventItem::startAt).thenComparing(CalendarEventItem::endAt));
    log.info(
        "❤️ [TOOL:get_calendar_events] occurrencesFetched={}, mergedEventCount={}",
        all.size(),
        events.size());
    return events;
  }

  @Transactional(readOnly = true)
  public List<TodoItem> getTodos(
      Long userId, LocalDate startDate, LocalDate endDate, Boolean doneOnlyOrNull) {
    validateDateRange(startDate, endDate);
    log.info(
        "❤️ [TOOL:get_todos] userId={}, range={}~{}, doneFilter={}",
        userId,
        startDate,
        endDate,
        doneOnlyOrNull);
    List<ScheduleOccurrence> todos =
        scheduleOccurrenceRepository.findByUserAndTypeAndDateRange(
            userId, ScheduleType.TODO, startDate, endDate);
    List<TodoItem> result = new ArrayList<>();
    for (ScheduleOccurrence todo : todos) {
      if (doneOnlyOrNull != null && todo.isDone() != doneOnlyOrNull) continue;
      result.add(toTodoItem(todo));
    }
    log.info(
        "❤️ [TOOL:get_todos] rawTodoCount={}, returnedTodoCount={}", todos.size(), result.size());
    return result;
  }

  @Transactional(readOnly = true)
  public List<TodoItem> getTodosByAgent(
      Long userId, Long agentId, LocalDate startDate, LocalDate endDate, Boolean doneOnlyOrNull) {
    validateDateRange(startDate, endDate);
    if (agentId == null) return List.of();
    log.info(
        "❤️ [TOOL:get_todos_by_agent] userId={}, agentId={}, range={}~{}, doneFilter={}",
        userId,
        agentId,
        startDate,
        endDate,
        doneOnlyOrNull);
    List<ScheduleOccurrence> todos =
        scheduleOccurrenceRepository.findByUserAndTypeAndAgentAndDateRange(
            userId, ScheduleType.TODO, agentId, startDate, endDate);
    List<TodoItem> result = new ArrayList<>();
    for (ScheduleOccurrence todo : todos) {
      if (doneOnlyOrNull != null && todo.isDone() != doneOnlyOrNull) continue;
      result.add(toTodoItem(todo));
    }
    log.info(
        "❤️ [TOOL:get_todos_by_agent] rawTodoCount={}, returnedTodoCount={}",
        todos.size(),
        result.size());
    return result;
  }

  @Transactional(readOnly = true)
  public UserConstraintResponse getUserConstraints(Long userId) {
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    log.info(
        "❤️ [TOOL:get_user_constraints] userId={}, dayStart={}, dayEnd={}, intensity={}",
        userId,
        user.getDayStartTime(),
        user.getDayEndTime(),
        user.getIntensity());
    return new UserConstraintResponse(
        user.getDayStartTime(),
        user.getDayEndTime(),
        user.getAge(),
        user.getInterests(),
        user.getIntensity());
  }

  @Transactional(readOnly = true)
  public ReschedulePlanResponse simulateReschedule(Long userId, RescheduleSimulateRequest request) {
    validateDateRange(request.startDate(), request.endDate());
    log.info(
        "❤️ [TOOL:simulate_reschedule] userId={}, range={}~{}, todoIds={}, maxShiftDays={}, minBufferMinutes={}",
        userId,
        request.startDate(),
        request.endDate(),
        request.todoIds(),
        request.maxShiftDays(),
        request.minBufferMinutes());
    UserConstraintResponse constraints = getUserConstraints(userId);
    int minBufferMinutes =
        request.minBufferMinutes() == null ? 10 : Math.max(0, request.minBufferMinutes());
    int maxShiftDays = request.maxShiftDays() == null ? 7 : Math.max(0, request.maxShiftDays());

    List<ScheduleOccurrence> todos =
        scheduleOccurrenceRepository.findByUserAndTypeAndDateRange(
            userId, ScheduleType.TODO, request.startDate(), request.endDate());
    Set<Long> targetTodoIds =
        request.todoIds() == null ? Set.of() : new HashSet<>(request.todoIds());
    boolean hasTargetFilter = !targetTodoIds.isEmpty();

    List<ScheduleOccurrence> targetTodos = new ArrayList<>();
    for (ScheduleOccurrence todo : todos) {
      if (todo.isDone()) continue;
      if (hasTargetFilter && !targetTodoIds.contains(todo.getId())) continue;
      targetTodos.add(todo);
    }
    targetTodos.sort(Comparator.comparing(ScheduleOccurrence::getStartAt));

    List<ScheduleOccurrence> allItemsInWindow =
        scheduleOccurrenceRepository.findByUserAndDateRange(
            userId, request.startDate(), request.endDate().plusDays(maxShiftDays));

    Map<LocalDate, List<TimeBlock>> busyByDate =
        buildBusyMap(
            allItemsInWindow,
            expandRecurringTemplateBlocks(
                userId, request.startDate(), request.endDate().plusDays(maxShiftDays)));
    List<ReschedulePlanItem> items = new ArrayList<>();
    List<String> conflicts = new ArrayList<>();

    for (ScheduleOccurrence todo : targetTodos) {
      LocalDateTime originalStartAt = todo.getStartAt();
      LocalDateTime originalEndAt = todo.getEndAt();
      long durationMinutes =
          Math.max(5L, Duration.between(originalStartAt, originalEndAt).toMinutes());

      LocalDate candidateDate = todo.getOccurrenceDate();
      boolean placed = false;
      LocalDateTime proposedStartAt = originalStartAt;
      LocalDateTime proposedEndAt = originalEndAt;

      for (int shiftedDays = 0; shiftedDays <= maxShiftDays; shiftedDays++) {
        LocalDate date = candidateDate.plusDays(shiftedDays);
        LocalTime windowStartTime =
            constraints.dayStartTime() == null ? LocalTime.of(8, 0) : constraints.dayStartTime();
        LocalTime windowEndTime =
            constraints.dayEndTime() == null ? LocalTime.of(23, 0) : constraints.dayEndTime();
        LocalDateTime cursor = LocalDateTime.of(date, windowStartTime);
        LocalDateTime dayEnd = LocalDateTime.of(date, windowEndTime);

        List<TimeBlock> busyBlocks = busyByDate.computeIfAbsent(date, d -> new ArrayList<>());
        busyBlocks.sort(Comparator.comparing(TimeBlock::startAt));

        while (!cursor.plusMinutes(durationMinutes).isAfter(dayEnd)) {
          LocalDateTime slotEnd = cursor.plusMinutes(durationMinutes);
          if (!hasOverlap(cursor, slotEnd, busyBlocks, minBufferMinutes)) {
            proposedStartAt = cursor;
            proposedEndAt = slotEnd;
            busyBlocks.add(new TimeBlock(proposedStartAt, proposedEndAt));
            placed = true;
            break;
          }
          cursor = cursor.plusMinutes(15);
        }
        if (placed) break;
      }

      if (!placed) {
        conflicts.add("TODO #" + todo.getId() + " (" + todo.getTitle() + ")의 배치 가능한 슬롯을 찾지 못했습니다.");
        items.add(
            new ReschedulePlanItem(
                todo.getId(),
                todo.getTitle(),
                originalStartAt,
                originalEndAt,
                originalStartAt,
                originalEndAt,
                "UNCHANGED",
                "배치 실패로 기존 일정 유지"));
        continue;
      }

      String status =
          proposedStartAt.equals(originalStartAt) && proposedEndAt.equals(originalEndAt)
              ? "UNCHANGED"
              : "MOVED";
      String reason = "busy 기간을 고려하여 충돌 없는 슬롯으로 자동 재배치";
      items.add(
          new ReschedulePlanItem(
              todo.getId(),
              todo.getTitle(),
              originalStartAt,
              originalEndAt,
              proposedStartAt,
              proposedEndAt,
              status,
              reason));
    }

    boolean feasible = conflicts.isEmpty();
    log.info(
        "❤️ [TOOL:simulate_reschedule] targetTodoCount={}, planItemCount={}, conflictCount={}, feasible={}",
        targetTodos.size(),
        items.size(),
        conflicts.size(),
        feasible);
    return new ReschedulePlanResponse(UUID.randomUUID().toString(), feasible, conflicts, items);
  }

  @Transactional(readOnly = true)
  public ReschedulePlanResponse validatePlan(List<ReschedulePlanItem> planItems, Long userId) {
    if (planItems == null || planItems.isEmpty()) {
      log.info("❤️ [TOOL:validate_plan] userId={}, empty plan", userId);
      return new ReschedulePlanResponse(UUID.randomUUID().toString(), true, List.of(), List.of());
    }
    log.info("❤️ [TOOL:validate_plan] userId={}, inputPlanItemCount={}", userId, planItems.size());

    List<String> conflicts = new ArrayList<>();
    Map<LocalDate, List<TimeBlock>> proposedByDate = new HashMap<>();
    for (ReschedulePlanItem item : planItems) {
      if (item.proposedStartAt() == null || item.proposedEndAt() == null) {
        conflicts.add("TODO #" + item.todoId() + " 제안 시간이 비어 있습니다.");
        continue;
      }
      if (!item.proposedEndAt().isAfter(item.proposedStartAt())) {
        conflicts.add("TODO #" + item.todoId() + " 종료 시간이 시작 시간보다 빠르거나 같습니다.");
        continue;
      }

      LocalDate date = item.proposedStartAt().toLocalDate();
      List<TimeBlock> blocks = proposedByDate.computeIfAbsent(date, d -> new ArrayList<>());
      if (hasOverlap(item.proposedStartAt(), item.proposedEndAt(), blocks, 0)) {
        conflicts.add("TODO #" + item.todoId() + " 제안 시간이 다른 TODO 제안과 충돌합니다.");
      }
      blocks.add(new TimeBlock(item.proposedStartAt(), item.proposedEndAt()));
    }

    // 캘린더 고정 일정과의 충돌 검사
    LocalDate minDate =
        planItems.stream()
            .map(i -> i.proposedStartAt().toLocalDate())
            .min(LocalDate::compareTo)
            .orElse(null);
    LocalDate maxDate =
        planItems.stream()
            .map(i -> i.proposedEndAt().toLocalDate())
            .max(LocalDate::compareTo)
            .orElse(null);
    if (minDate != null && maxDate != null) {
      List<ScheduleOccurrence> allItems =
          scheduleOccurrenceRepository.findByUserAndDateRange(userId, minDate, maxDate);
      List<TimeBlock> fixedBlocks = new ArrayList<>();
      for (ScheduleOccurrence item : allItems) {
        if (item.getType() == ScheduleType.TODO) continue;
        fixedBlocks.add(new TimeBlock(item.getStartAt(), item.getEndAt()));
      }
      fixedBlocks.addAll(expandRecurringTemplateBlocks(userId, minDate, maxDate));
      for (ReschedulePlanItem item : planItems) {
        if (hasOverlap(item.proposedStartAt(), item.proposedEndAt(), fixedBlocks, 0)) {
          conflicts.add("TODO #" + item.todoId() + " 제안 시간이 캘린더 고정 일정과 충돌합니다.");
        }
      }
    }

    boolean feasible = conflicts.isEmpty();
    log.info(
        "❤️ [TOOL:validate_plan] outputConflictCount={}, feasible={}", conflicts.size(), feasible);
    return new ReschedulePlanResponse(UUID.randomUUID().toString(), feasible, conflicts, planItems);
  }

  @Transactional
  public RescheduleApplyResponse applyPlan(Long userId, RescheduleApplyRequest request) {
    if (request.items() == null || request.items().isEmpty()) {
      log.info(
          "❤️ [TOOL:apply_reschedule] userId={}, mode={}, empty apply", userId, request.mode());
      return new RescheduleApplyResponse(
          UUID.randomUUID().toString(), request.mode(), 0, List.of());
    }
    log.info(
        "❤️ [TOOL:apply_reschedule] userId={}, mode={}, inputItemCount={}",
        userId,
        request.mode(),
        request.items().size());

    if (request.mode() == ApplyMode.DRAFT) {
      log.info("❤️ [TOOL:apply_reschedule] draft generated without DB commit");
      return new RescheduleApplyResponse(
          UUID.randomUUID().toString(), ApplyMode.DRAFT, request.items().size(), request.items());
    }

    List<Long> ids = request.items().stream().map(ReschedulePlanItem::todoId).toList();
    List<ScheduleOccurrence> todos =
        scheduleOccurrenceRepository.findByUserAccount_IdAndIdIn(userId, ids);
    Map<Long, ScheduleOccurrence> todoById = new HashMap<>();
    for (ScheduleOccurrence todo : todos) {
      if (todo.getType() != ScheduleType.TODO) continue;
      todoById.put(todo.getId(), todo);
    }

    List<ReschedulePlanItem> appliedItems = new ArrayList<>();
    for (ReschedulePlanItem item : request.items()) {
      ScheduleOccurrence todo = todoById.get(item.todoId());
      if (todo == null) {
        throw new IllegalArgumentException("적용 대상 TODO를 찾을 수 없습니다. id=" + item.todoId());
      }
      LocalDateTime nextStartAt = item.proposedStartAt();
      LocalDateTime nextEndAt = item.proposedEndAt();
      if (nextStartAt == null || nextEndAt == null || !nextEndAt.isAfter(nextStartAt)) {
        throw new IllegalArgumentException("적용 시간 값이 올바르지 않습니다. id=" + item.todoId());
      }
      todo.setStartAt(nextStartAt);
      todo.setEndAt(nextEndAt);
      todo.setOccurrenceDate(nextStartAt.toLocalDate());
      appliedItems.add(
          new ReschedulePlanItem(
              item.todoId(),
              todo.getTitle(),
              item.originalStartAt(),
              item.originalEndAt(),
              nextStartAt,
              nextEndAt,
              "MOVED",
              item.reason()));
    }

    scheduleOccurrenceRepository.saveAll(todoById.values());
    log.info("❤️ [TOOL:apply_reschedule] commit appliedCount={}", appliedItems.size());
    return new RescheduleApplyResponse(
        UUID.randomUUID().toString(), ApplyMode.COMMIT, appliedItems.size(), appliedItems);
  }

  @Transactional
  public RescheduleRollbackResponse rollback(Long userId, RescheduleRollbackRequest request) {
    if (request.appliedItems() == null || request.appliedItems().isEmpty()) {
      log.info("❤️ [TOOL:rollback_last_change] userId={}, empty rollback", userId);
      return new RescheduleRollbackResponse(UUID.randomUUID().toString(), 0);
    }
    log.info(
        "❤️ [TOOL:rollback_last_change] userId={}, inputAppliedItemCount={}",
        userId,
        request.appliedItems().size());
    List<Long> ids = request.appliedItems().stream().map(ReschedulePlanItem::todoId).toList();
    List<ScheduleOccurrence> todos =
        scheduleOccurrenceRepository.findByUserAccount_IdAndIdIn(userId, ids);
    Map<Long, ScheduleOccurrence> todoById = new HashMap<>();
    for (ScheduleOccurrence todo : todos) {
      if (todo.getType() != ScheduleType.TODO) continue;
      todoById.put(todo.getId(), todo);
    }

    int count = 0;
    for (ReschedulePlanItem item : request.appliedItems()) {
      ScheduleOccurrence todo = todoById.get(item.todoId());
      if (todo == null) continue;
      if (item.originalStartAt() == null || item.originalEndAt() == null) continue;
      todo.setStartAt(item.originalStartAt());
      todo.setEndAt(item.originalEndAt());
      todo.setOccurrenceDate(item.originalStartAt().toLocalDate());
      count++;
    }
    scheduleOccurrenceRepository.saveAll(todoById.values());
    log.info("❤️ [TOOL:rollback_last_change] rollbackCount={}", count);
    return new RescheduleRollbackResponse(UUID.randomUUID().toString(), count);
  }

  @Transactional(readOnly = true)
  public String explainPlan(RescheduleExplainRequest request) {
    int movedCount = 0;
    int unchangedCount = 0;
    if (request.items() != null) {
      for (ReschedulePlanItem item : request.items()) {
        if ("MOVED".equalsIgnoreCase(item.status())) movedCount++;
        else unchangedCount++;
      }
    }
    int conflictCount = request.conflicts() == null ? 0 : request.conflicts().size();
    String explanation =
        "요청 메시지(\""
            + (request.userMessage() == null ? "" : request.userMessage())
            + "\")를 기준으로 "
            + movedCount
            + "개 TODO를 재배치했고, "
            + unchangedCount
            + "개는 유지했습니다. "
            + (conflictCount > 0
                ? ("충돌/제약 " + conflictCount + "건이 있어 추가 확인이 필요합니다.")
                : "충돌 없이 적용 가능한 계획입니다.");
    log.info(
        "❤️ [TOOL:explain_tradeoffs] movedCount={}, unchangedCount={}, conflictCount={}",
        movedCount,
        unchangedCount,
        conflictCount);
    return explanation;
  }

  private TodoItem toTodoItem(ScheduleOccurrence todo) {
    return new TodoItem(
        todo.getId(),
        todo.getTitle(),
        todo.getDescription(),
        todo.isDone(),
        todo.getOccurrenceDate(),
        todo.getStartAt(),
        todo.getEndAt(),
        todo.getAgentId(),
        todo.getGroupId(),
        todo.getGroupTitle());
  }

  private void validateDateRange(LocalDate startDate, LocalDate endDate) {
    if (startDate == null || endDate == null) {
      throw new IllegalArgumentException("startDate / endDate 는 필수입니다.");
    }
    if (endDate.isBefore(startDate)) {
      throw new IllegalArgumentException("endDate 는 startDate 이후여야 합니다.");
    }
  }

  private Map<LocalDate, List<TimeBlock>> buildBusyMap(
      List<ScheduleOccurrence> occurrences, List<TimeBlock> recurringBlocks) {
    Map<LocalDate, List<TimeBlock>> busyByDate = new HashMap<>();
    for (ScheduleOccurrence occurrence : occurrences) {
      if (occurrence.getType() == ScheduleType.TODO) continue;
      LocalDate date = occurrence.getStartAt().toLocalDate();
      busyByDate
          .computeIfAbsent(date, d -> new ArrayList<>())
          .add(new TimeBlock(occurrence.getStartAt(), occurrence.getEndAt()));
    }
    for (TimeBlock recurringBlock : recurringBlocks) {
      LocalDate date = recurringBlock.startAt().toLocalDate();
      busyByDate.computeIfAbsent(date, d -> new ArrayList<>()).add(recurringBlock);
    }
    return busyByDate;
  }

  private List<CalendarEventItem> expandRecurringTemplateEvents(
      Long userId, LocalDate startDate, LocalDate endDate) {
    List<RecurringScheduleTemplate> templates =
        recurringScheduleTemplateRepository.findByUserAccount_Id(userId);
    List<CalendarEventItem> events = new ArrayList<>();
    for (RecurringScheduleTemplate template : templates) {
      Set<DayOfWeek> weekdays = parseWeekdays(template.getRepeatWeekdays());
      if (weekdays.isEmpty()) continue;
      LocalDate from =
          startDate.isAfter(template.getPeriodStartDate())
              ? startDate
              : template.getPeriodStartDate();
      LocalDate to =
          endDate.isBefore(template.getPeriodEndDate()) ? endDate : template.getPeriodEndDate();
      if (to.isBefore(from)) continue;

      for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
        if (!weekdays.contains(date.getDayOfWeek())) continue;
        LocalDateTime startAt = LocalDateTime.of(date, template.getStartTime());
        LocalDateTime endAt = LocalDateTime.of(date, template.getEndTime());
        events.add(
            new CalendarEventItem(
                null, template.getTitle(), template.getDescription(), date, startAt, endAt));
      }
    }
    return events;
  }

  private List<TimeBlock> expandRecurringTemplateBlocks(
      Long userId, LocalDate startDate, LocalDate endDate) {
    List<CalendarEventItem> events = expandRecurringTemplateEvents(userId, startDate, endDate);
    List<TimeBlock> blocks = new ArrayList<>();
    for (CalendarEventItem event : events) {
      if (event.startAt() == null || event.endAt() == null) continue;
      blocks.add(new TimeBlock(event.startAt(), event.endAt()));
    }
    return blocks;
  }

  private Set<DayOfWeek> parseWeekdays(String rawWeekdays) {
    Set<DayOfWeek> result = new HashSet<>();
    if (rawWeekdays == null || rawWeekdays.isBlank()) return result;
    String[] parts = rawWeekdays.split(",");
    for (String part : parts) {
      if (part == null) continue;
      String code = part.trim().toUpperCase();
      if (code.isEmpty()) continue;
      try {
        result.add(parseDayOfWeek(code));
      } catch (Exception ignored) {
      }
    }
    return result;
  }

  private DayOfWeek parseDayOfWeek(String rawCode) {
    return switch (rawCode) {
      case "MON", "MONDAY", "월" -> DayOfWeek.MONDAY;
      case "TUE", "TUESDAY", "화" -> DayOfWeek.TUESDAY;
      case "WED", "WEDNESDAY", "수" -> DayOfWeek.WEDNESDAY;
      case "THU", "THURSDAY", "목" -> DayOfWeek.THURSDAY;
      case "FRI", "FRIDAY", "금" -> DayOfWeek.FRIDAY;
      case "SAT", "SATURDAY", "토" -> DayOfWeek.SATURDAY;
      case "SUN", "SUNDAY", "일" -> DayOfWeek.SUNDAY;
      default -> throw new IllegalArgumentException("지원하지 않는 요일 코드: " + rawCode);
    };
  }

  private boolean hasOverlap(
      LocalDateTime startAt, LocalDateTime endAt, List<TimeBlock> blocks, int minBufferMinutes) {
    for (TimeBlock block : blocks) {
      LocalDateTime bufferedStart = block.startAt().minusMinutes(minBufferMinutes);
      LocalDateTime bufferedEnd = block.endAt().plusMinutes(minBufferMinutes);
      boolean overlaps = startAt.isBefore(bufferedEnd) && endAt.isAfter(bufferedStart);
      if (overlaps) return true;
    }
    return false;
  }

  private record TimeBlock(LocalDateTime startAt, LocalDateTime endAt) {}
}
