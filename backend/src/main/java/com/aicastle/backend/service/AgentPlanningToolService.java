package com.aicastle.backend.service;

import com.aicastle.backend.dto.AgentPlanningToolDtos.*;
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
    log.info("❤️ [에이전트 툴:일정조회] 사용자ID={}, 조회범위={}~{}", userId, startDate, endDate);
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
    log.info("❤️ [에이전트 툴:일정조회] 원본건수={}, 병합건수={}", all.size(), events.size());
    return events;
  }

  @Transactional(readOnly = true)
  public List<TodoItem> getTodos(
      Long userId, LocalDate startDate, LocalDate endDate, Boolean doneOnlyOrNull) {
    validateDateRange(startDate, endDate);
    log.info(
        "❤️ [에이전트 툴:할일조회] 사용자ID={}, 조회범위={}~{}, 완료필터={}",
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
    log.info("❤️ [에이전트 툴:할일조회] 원본건수={}, 반환건수={}", todos.size(), result.size());
    return result;
  }

  @Transactional(readOnly = true)
  public List<TodoItem> getTodosByAgent(
      Long userId, Long agentId, LocalDate startDate, LocalDate endDate, Boolean doneOnlyOrNull) {
    validateDateRange(startDate, endDate);
    if (agentId == null) return List.of();
    log.info(
        "❤️ [에이전트 툴:에이전트할일조회] 사용자ID={}, 에이전트ID={}, 조회범위={}~{}, 완료필터={}",
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
    log.info("❤️ [에이전트 툴:에이전트할일조회] 원본건수={}, 반환건수={}", todos.size(), result.size());
    return result;
  }

  @Transactional(readOnly = true)
  public UserConstraintResponse getUserConstraints(Long userId) {
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    log.info(
        "❤️ [에이전트 툴:사용자제약조회] 사용자ID={}, 시작시간={}, 종료시간={}, 강도={}",
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
        "❤️ [에이전트 툴:재배치시뮬레이션] 사용자ID={}, 조회범위={}~{}, 대상할일ID={}, 최대이동일수={}, 최소버퍼분={}",
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
        "❤️ [에이전트 툴:재배치시뮬레이션] 대상건수={}, 계획건수={}, 충돌건수={}, 실행가능={}",
        targetTodos.size(),
        items.size(),
        conflicts.size(),
        feasible);
    return new ReschedulePlanResponse(UUID.randomUUID().toString(), feasible, conflicts, items);
  }

  @Transactional(readOnly = true)
  public ReschedulePlanResponse validatePlan(List<ReschedulePlanItem> planItems, Long userId) {
    if (planItems == null || planItems.isEmpty()) {
      log.info("❤️ [에이전트 툴:계획검증] 사용자ID={}, 입력계획없음", userId);
      return new ReschedulePlanResponse(UUID.randomUUID().toString(), true, List.of(), List.of());
    }
    log.info("❤️ [에이전트 툴:계획검증] 사용자ID={}, 입력계획건수={}", userId, planItems.size());

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
    log.info("❤️ [에이전트 툴:계획검증] 충돌건수={}, 실행가능={}", conflicts.size(), feasible);
    return new ReschedulePlanResponse(UUID.randomUUID().toString(), feasible, conflicts, planItems);
  }

  @Transactional
  public RescheduleApplyResponse applyPlan(Long userId, RescheduleApplyRequest request) {
    if (request.items() == null || request.items().isEmpty()) {
      log.info("❤️ [에이전트 툴:재배치적용] 사용자ID={}, 적용모드={}, 입력항목없음", userId, request.mode());
      return new RescheduleApplyResponse(
          UUID.randomUUID().toString(), request.mode(), 0, List.of());
    }
    log.info(
        "❤️ [에이전트 툴:재배치적용] 사용자ID={}, 적용모드={}, 입력항목수={}",
        userId,
        request.mode(),
        request.items().size());

    if (request.mode() == ApplyMode.DRAFT) {
      log.info("❤️ [에이전트 툴:재배치적용] 초안모드로 저장, DB 반영 없음");
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
    log.info("❤️ [에이전트 툴:재배치적용] 커밋 완료, 적용건수={}", appliedItems.size());
    return new RescheduleApplyResponse(
        UUID.randomUUID().toString(), ApplyMode.COMMIT, appliedItems.size(), appliedItems);
  }

  @Transactional
  public RescheduleRollbackResponse rollback(Long userId, RescheduleRollbackRequest request) {
    if (request.appliedItems() == null || request.appliedItems().isEmpty()) {
      log.info("❤️ [에이전트 툴:되돌리기] 사용자ID={}, 되돌릴항목없음", userId);
      return new RescheduleRollbackResponse(UUID.randomUUID().toString(), 0);
    }
    log.info("❤️ [에이전트 툴:되돌리기] 사용자ID={}, 입력적용항목수={}", userId, request.appliedItems().size());
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
    log.info("❤️ [에이전트 툴:되돌리기] 되돌린건수={}", count);
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
        "❤️ [에이전트 툴:설명생성] 이동건수={}, 유지건수={}, 충돌건수={}", movedCount, unchangedCount, conflictCount);
    return explanation;
  }

  @Transactional(readOnly = true)
  public TimePreferenceResponse resolveTimePreference(Long userId, TimePreferenceRequest request) {
    UserConstraintResponse constraints = getUserConstraints(userId);
    int sleepDebtMinutes =
        request == null || request.sleepDebtMinutes() == null
            ? 0
            : Math.max(0, request.sleepDebtMinutes());
    String baseWindow =
        request == null || request.window() == null ? "MORNING" : request.window().toUpperCase();
    String recommendedWindow = sleepDebtMinutes >= 120 ? "AFTERNOON" : baseWindow;
    String intensityAdjustment = sleepDebtMinutes >= 120 ? "LIGHTEN" : "KEEP";
    String reason =
        "dayStart="
            + constraints.dayStartTime()
            + ", dayEnd="
            + constraints.dayEndTime()
            + ", sleepDebtMinutes="
            + sleepDebtMinutes;
    log.info("❤️ [에이전트 툴:시간선호해결] 사용자ID={}, 추천시간대={}", userId, recommendedWindow);
    return new TimePreferenceResponse(recommendedWindow, intensityAdjustment, reason);
  }

  @Transactional(readOnly = true)
  public EnergyCurveResponse getEnergyCurve(Long userId, EnergyCurveRequest request) {
    validateDateRange(request.startDate(), request.endDate());
    List<EnergyCurveItem> items = new ArrayList<>();
    for (LocalDate date = request.startDate();
        !date.isAfter(request.endDate());
        date = date.plusDays(1)) {
      String peakWindow =
          switch (date.getDayOfWeek()) {
            case SATURDAY, SUNDAY -> "10:00-12:00";
            default -> "09:00-11:00";
          };
      items.add(new EnergyCurveItem(date, peakWindow, "14:00-16:00"));
    }
    log.info("❤️ [에이전트 툴:에너지곡선] 사용자ID={}, 일수={}", userId, items.size());
    return new EnergyCurveResponse(items);
  }

  public TaskEffortEstimateResponse estimateTaskEffort(TaskEffortEstimateRequest request) {
    log.info("❤️ [에이전트 툴:작업시간추정] 요청={}", request);
    String text = request == null || request.taskText() == null ? "" : request.taskText();
    String level =
        request == null || request.userLevel() == null
            ? "medium"
            : request.userLevel().toLowerCase();
    int base = text.length() >= 40 ? 60 : 40;
    if (text.contains("모의") || text.contains("기출")) base += 20;
    if ("beginner".equals(level)) base += 20;
    if ("advanced".equals(level)) base -= 10;
    int estimated = Math.max(20, base);
    TaskEffortEstimateResponse response =
        new TaskEffortEstimateResponse(estimated, "taskLength/keyword/userLevel 기반 추정");
    log.info("❤️ [에이전트 툴:작업시간추정] 결과={}", response);
    return response;
  }

  public SplitTaskResponse splitTask(SplitTaskRequest request) {
    log.info("❤️ [에이전트 툴:작업분할] 요청={}", request);
    int total =
        request == null || request.totalMinutes() == null
            ? 60
            : Math.max(10, request.totalMinutes());
    int block =
        request == null || request.blockMinutes() == null
            ? 30
            : Math.max(10, request.blockMinutes());
    String title = request == null || request.title() == null ? "작업" : request.title();
    List<SplitTaskItem> items = new ArrayList<>();
    int remaining = total;
    int index = 1;
    while (remaining > 0) {
      int minutes = Math.min(block, remaining);
      items.add(new SplitTaskItem(title + " - " + index + "단계", minutes, "집중 블록"));
      remaining -= minutes;
      index++;
    }
    SplitTaskResponse response = new SplitTaskResponse(items);
    log.info("❤️ [에이전트 툴:작업분할] 분할건수={}", items.size());
    return response;
  }

  public PriorityRankResponse rankTaskPriority(PriorityRankRequest request) {
    log.info(
        "❤️ [에이전트 툴:우선순위정렬] 입력건수={}",
        request == null || request.items() == null ? 0 : request.items().size());
    List<PriorityRankItem> items =
        request == null || request.items() == null
            ? new ArrayList<>()
            : new ArrayList<>(request.items());
    items.sort(
        (a, b) ->
            Integer.compare(b.score() == null ? 0 : b.score(), a.score() == null ? 0 : a.score()));
    PriorityRankResponse response = new PriorityRankResponse(items);
    log.info("❤️ [에이전트 툴:우선순위정렬] 정렬결과건수={}", items.size());
    return response;
  }

  @Transactional(readOnly = true)
  public OverloadDetectResponse detectOverload(Long userId, OverloadDetectRequest request) {
    validateDateRange(request.startDate(), request.endDate());
    int maxDaily =
        request.maxDailyMinutes() == null ? 480 : Math.max(60, request.maxDailyMinutes());
    List<TodoItem> todos = getTodos(userId, request.startDate(), request.endDate(), false);
    Map<LocalDate, Integer> totalMinutesByDate = new HashMap<>();
    for (TodoItem todo : todos) {
      LocalDate date = todo.date();
      if (date == null && todo.startAt() != null) date = todo.startAt().toLocalDate();
      if (date == null) continue;
      int minutes = 0;
      if (todo.startAt() != null && todo.endAt() != null) {
        minutes = (int) Math.max(0, Duration.between(todo.startAt(), todo.endAt()).toMinutes());
      }
      totalMinutesByDate.put(date, totalMinutesByDate.getOrDefault(date, 0) + minutes);
    }

    List<OverloadDay> days = new ArrayList<>();
    boolean overloaded = false;
    for (LocalDate date = request.startDate();
        !date.isAfter(request.endDate());
        date = date.plusDays(1)) {
      int total = totalMinutesByDate.getOrDefault(date, 0);
      boolean dayOverloaded = total > maxDaily;
      if (dayOverloaded) overloaded = true;
      days.add(new OverloadDay(date, total, dayOverloaded, dayOverloaded ? "일일 한도 초과" : "정상"));
    }
    return new OverloadDetectResponse(overloaded, days);
  }

  public BufferInsertResponse insertBufferBlocks(BufferInsertRequest request) {
    log.info("❤️ [에이전트 툴:버퍼삽입] 요청={}", request);
    int bufferMinutes =
        request == null || request.bufferMinutes() == null
            ? 10
            : Math.max(0, request.bufferMinutes());
    if (request == null || request.items() == null) return new BufferInsertResponse(List.of());
    List<ReschedulePlanItem> adjusted = new ArrayList<>();
    LocalDateTime nextStartFloor = null;
    for (ReschedulePlanItem item : request.items()) {
      if (item.proposedStartAt() == null || item.proposedEndAt() == null) {
        adjusted.add(item);
        continue;
      }
      LocalDateTime start = item.proposedStartAt();
      LocalDateTime end = item.proposedEndAt();
      if (nextStartFloor != null && start.isBefore(nextStartFloor)) {
        long duration = Math.max(5, Duration.between(start, end).toMinutes());
        start = nextStartFloor;
        end = start.plusMinutes(duration);
      }
      adjusted.add(
          new ReschedulePlanItem(
              item.todoId(),
              item.title(),
              item.originalStartAt(),
              item.originalEndAt(),
              start,
              end,
              item.status(),
              item.reason()));
      nextStartFloor = end.plusMinutes(bufferMinutes);
    }
    BufferInsertResponse response = new BufferInsertResponse(adjusted);
    log.info("❤️ [에이전트 툴:버퍼삽입] 조정건수={}", adjusted.size());
    return response;
  }

  public CommuteAwareResponse commuteAwareSchedule(CommuteAwareRequest request) {
    log.info("❤️ [에이전트 툴:이동시간반영] 요청={}", request);
    int commuteMinutes =
        request == null || request.commuteMinutes() == null
            ? 20
            : Math.max(0, request.commuteMinutes());
    if (request == null || request.items() == null) {
      return new CommuteAwareResponse(List.of(), List.of());
    }
    List<String> conflicts = new ArrayList<>();
    List<ReschedulePlanItem> adjusted = new ArrayList<>();
    LocalDateTime prevEnd = null;
    for (ReschedulePlanItem item : request.items()) {
      if (item.proposedStartAt() == null || item.proposedEndAt() == null) {
        adjusted.add(item);
        continue;
      }
      if (prevEnd != null && item.proposedStartAt().isBefore(prevEnd.plusMinutes(commuteMinutes))) {
        conflicts.add("TODO #" + item.todoId() + " 이동 시간 부족");
      }
      adjusted.add(item);
      prevEnd = item.proposedEndAt();
    }
    CommuteAwareResponse response = new CommuteAwareResponse(conflicts, adjusted);
    log.info("❤️ [에이전트 툴:이동시간반영] 충돌건수={}", conflicts.size());
    return response;
  }

  public DeadlineRiskResponse getDeadlineRiskScore(DeadlineRiskRequest request) {
    log.info("❤️ [에이전트 툴:마감리스크] 요청={}", request);
    int horizonDays =
        request == null || request.horizonDays() == null ? 14 : Math.max(1, request.horizonDays());
    int riskScore = horizonDays <= 3 ? 90 : horizonDays <= 7 ? 70 : horizonDays <= 14 ? 45 : 20;
    String riskLevel = riskScore >= 80 ? "HIGH" : riskScore >= 50 ? "MEDIUM" : "LOW";
    DeadlineRiskResponse response =
        new DeadlineRiskResponse(
            request == null ? "unknown" : request.goalId(),
            riskScore,
            riskLevel,
            "horizonDays 기반 단순 리스크 추정");
    log.info("❤️ [에이전트 툴:마감리스크] 결과={}", response);
    return response;
  }

  public NegotiationOptionsResponse suggestNegotiationOptions(List<ReschedulePlanItem> items) {
    log.info("❤️ [에이전트 툴:협상옵션추천] 입력건수={}", items == null ? 0 : items.size());
    List<ReschedulePlanItem> safeItems = items == null ? List.of() : items;
    List<NegotiationOption> options =
        List.of(
            new NegotiationOption("볼륨 축소", "총 작업량을 20% 줄이는 안", safeItems),
            new NegotiationOption("기한 연장", "중요도 낮은 항목을 1~2일 뒤로 이동", safeItems),
            new NegotiationOption("블록 분할", "긴 작업을 여러 블록으로 분할", safeItems));
    NegotiationOptionsResponse response = new NegotiationOptionsResponse(options);
    log.info("❤️ [에이전트 툴:협상옵션추천] 옵션건수={}", options.size());
    return response;
  }

  @Transactional
  public ApplySafeguardResponse applyWithSafeguard(Long userId, ApplySafeguardRequest request) {
    log.info("❤️ [에이전트 툴:안전적용] 사용자ID={}, 요청={}", userId, request);
    List<ReschedulePlanItem> items =
        request == null || request.items() == null ? List.of() : request.items();
    if (request != null && request.dryRun()) {
      List<String> diff =
          items.stream()
              .map(
                  item ->
                      "TODO #"
                          + item.todoId()
                          + ": "
                          + item.originalStartAt()
                          + " -> "
                          + item.proposedStartAt())
              .toList();
      ApplySafeguardResponse response = new ApplySafeguardResponse(true, items.size(), diff, items);
      log.info("❤️ [에이전트 툴:안전적용] 드라이런 영향건수={}", response.impactedCount());
      return response;
    }
    RescheduleApplyResponse applied =
        applyPlan(userId, new RescheduleApplyRequest(ApplyMode.COMMIT, items));
    List<String> diff =
        applied.appliedItems().stream()
            .map(
                item ->
                    "TODO #"
                        + item.todoId()
                        + ": "
                        + item.originalStartAt()
                        + " -> "
                        + item.proposedStartAt())
            .toList();
    ApplySafeguardResponse response =
        new ApplySafeguardResponse(false, applied.appliedCount(), diff, applied.appliedItems());
    log.info("❤️ [에이전트 툴:안전적용] 커밋 영향건수={}", response.impactedCount());
    return response;
  }

  public String explainPlanBrief(ExplainBriefRequest request) {
    log.info("❤️ [에이전트 툴:요약설명] 요청={}", request);
    String text = request == null || request.text() == null ? "" : request.text();
    String style =
        request == null || request.style() == null ? "summary" : request.style().toLowerCase();
    String response =
        switch (style) {
          case "reason" -> "근거 중심 요약: " + text;
          case "motivation" -> "동기부여 요약: 오늘도 충분히 해낼 수 있습니다. " + text;
          default -> "요약: " + text;
        };
    log.info("❤️ [에이전트 툴:요약설명] 결과={}", response);
    return response;
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
