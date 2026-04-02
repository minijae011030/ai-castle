package com.aicastle.backend.service;

import com.aicastle.backend.dto.ChatDtos.ChatMessageResponse;
import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.dto.ChatDtos.ChatSendRequest;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.Report;
import com.aicastle.backend.entity.ScheduleOccurrence;
import com.aicastle.backend.entity.ScheduleOccurrence.ScheduleType;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.ReportRepository;
import com.aicastle.backend.repository.ScheduleOccurrenceRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ReportService {

  private static final Logger log = LoggerFactory.getLogger(ReportService.class);

  private final AgentChatService agentChatService;
  private final AgentRoleRepository agentRoleRepository;
  private final ReportRepository reportRepository;
  private final ScheduleOccurrenceRepository scheduleOccurrenceRepository;

  public ReportService(
      AgentChatService agentChatService,
      AgentRoleRepository agentRoleRepository,
      ReportRepository reportRepository,
      ScheduleOccurrenceRepository scheduleOccurrenceRepository) {
    this.agentChatService = agentChatService;
    this.agentRoleRepository = agentRoleRepository;
    this.scheduleOccurrenceRepository = scheduleOccurrenceRepository;
    this.reportRepository = reportRepository;
  }

  /** START 배치: 오늘 날짜/일정/어제 미완료 항목을 컨텍스트로 메인 에이전트에 발송한다. */
  public void runMainStartBatch(UserAccount user, AgentRole mainAgent, LocalDate today) {
    try {
      String context = buildDailyContext(user.getId(), today);
      String prompt =
          context
              + "\n\n위 정보를 바탕으로 사용자에게 오늘 하루 일정을 친근하게 브리핑해 주세요. TODO를 생성하지 말고, 오늘 어떤 날인지 안내만 해주세요.";
      ChatMessageResponse response =
          agentChatService.sendBatchBriefing(user.getId(), mainAgent.getId(), prompt);
      log.info("👉 [배치-START] 메인 에이전트 브리핑 완료 mainAgentId={}", mainAgent.getId());
      log.info("💬 [메인브리핑] {}", response.content());
    } catch (Exception e) {
      log.warn(
          "👉 [배치-START] 메인 에이전트 TODO 생성 실패 mainAgentId={} reason={}",
          mainAgent.getId(),
          e.getMessage());
    }
  }

  private String buildDailyContext(Long userId, LocalDate today) {
    LocalDate yesterday = today.minusDays(1);
    String dayOfWeek = today.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.KOREAN);

    List<ScheduleOccurrence> todaySchedules =
        scheduleOccurrenceRepository.findByUserAccount_IdAndOccurrenceDateOrderByStartAtAsc(
            userId, today);
    List<ScheduleOccurrence> yesterdayIncomplete =
        scheduleOccurrenceRepository
            .findByUserAccount_IdAndOccurrenceDateOrderByStartAtAsc(userId, yesterday)
            .stream()
            .filter(s -> !s.isDone())
            .toList();

    StringBuilder sb = new StringBuilder();
    sb.append("[일과 시작 배치] ").append(today).append(" (").append(dayOfWeek).append(")\n");

    // 오늘 정기일정/일정
    List<ScheduleOccurrence> todayFixed =
        todaySchedules.stream()
            .filter(
                s ->
                    s.getType() == ScheduleType.RECURRING_OCCURRENCE
                        || s.getType() == ScheduleType.CALENDAR_EVENT)
            .toList();
    sb.append("\n📅 오늘 정기일정/일정 (").append(todayFixed.size()).append("건)\n");
    if (todayFixed.isEmpty()) {
      sb.append("  (없음)\n");
    } else {
      todayFixed.forEach(s -> sb.append(formatScheduleLine(s)).append("\n"));
    }

    // 오늘 할 일 (TODO)
    List<ScheduleOccurrence> todayTodos =
        todaySchedules.stream().filter(s -> s.getType() == ScheduleType.TODO).toList();
    sb.append("\n✅ 오늘 할 일 (").append(todayTodos.size()).append("건)\n");
    if (todayTodos.isEmpty()) {
      sb.append("  (없음)\n");
    } else {
      todayTodos.forEach(s -> sb.append(formatScheduleLine(s)).append("\n"));
    }

    // 어제 미완료
    sb.append("\n⚠️ 어제 미완료 항목 (").append(yesterdayIncomplete.size()).append("건)\n");
    if (yesterdayIncomplete.isEmpty()) {
      sb.append("  (없음)\n");
    } else {
      yesterdayIncomplete.forEach(s -> sb.append(formatScheduleLine(s)).append("\n"));
    }

    return sb.toString().trim();
  }

  private String formatScheduleLine(ScheduleOccurrence s) {
    String typeLabel =
        switch (s.getType()) {
          case RECURRING_OCCURRENCE -> "정기";
          case CALENDAR_EVENT -> "일정";
          case TODO -> "할일";
        };
    String time =
        s.getStartAt() != null
            ? s.getStartAt().toLocalTime().toString().substring(0, 5)
                + "-"
                + s.getEndAt().toLocalTime().toString().substring(0, 5)
            : "--:--";
    return "  [" + typeLabel + "] " + time + " | " + s.getTitle();
  }

  /**
   * START 배치: 메인 에이전트에 속한 서브 에이전트들에게 TODO 생성 메시지를 병렬 발송한다. 각 서브 에이전트는 자신의 담당 일정을 기반으로 오늘 할 일을 생성한다.
   */
  public void runSubStartBatch(UserAccount user, AgentRole mainAgent, LocalDate today) {
    List<AgentRole> subAgents =
        agentRoleRepository.findByRoleTypeAndMainAgent_IdOrderByNameAsc(
            AgentRoleType.SUB, mainAgent.getId());
    if (subAgents.isEmpty()) {
      log.info("👉 [배치-START] 서브 에이전트 없음 mainAgentId={}", mainAgent.getId());
      return;
    }

    String subBriefingPrompt =
        "일과 시작 배치입니다. 오늘 날짜는 "
            + today
            + "입니다. 오늘 내 담당 일정을 확인하고, 사용자에게 오늘 어떤 학습이 예정되어 있는지 친근하게 브리핑해 주세요. TODO를 생성하지 말고 안내만 해주세요.";

    List<CompletableFuture<Void>> futures =
        subAgents.stream()
            .map(
                sub ->
                    CompletableFuture.runAsync(
                        () -> {
                          try {
                            ChatMessageResponse subResponse =
                                agentChatService.sendBatchBriefing(
                                    user.getId(), sub.getId(), subBriefingPrompt);
                            log.info(
                                "👉 [배치-START] 서브 에이전트 브리핑 완료 subAgentId={} name={}",
                                sub.getId(),
                                sub.getName());
                            log.info("💬 [서브브리핑:{}] {}", sub.getName(), subResponse.content());
                          } catch (Exception e) {
                            log.warn(
                                "👉 [배치-START] 서브 TODO 생성 실패 subAgentId={} reason={}",
                                sub.getId(),
                                e.getMessage());
                          }
                        }))
            .toList();

    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    log.info(
        "👉 [배치-START] 전체 서브 에이전트 처리 완료 mainAgentId={} subCount={}",
        mainAgent.getId(),
        subAgents.size());
  }

  /**
   * END 배치: 1) 서브 에이전트들에게 오늘 진행 내용 요약 요청 → Report 저장 (병렬) 2) 서브 리포트를 컨텍스트로 메인 에이전트 최종 요약 생성 →
   * Report 저장
   */
  public void runEndBatch(UserAccount user, AgentRole mainAgent, LocalDate today) {
    List<AgentRole> subAgents =
        agentRoleRepository.findByRoleTypeAndMainAgent_IdOrderByNameAsc(
            AgentRoleType.SUB, mainAgent.getId());

    // 1. 서브 에이전트 리포트 수집
    List<String> subReportSummaries = collectSubReports(user, subAgents, today);

    // 2. 메인 에이전트 최종 요약 생성 및 저장
    generateAndSaveMainReport(user, mainAgent, subReportSummaries, today);
  }

  private List<String> collectSubReports(
      UserAccount user, List<AgentRole> subAgents, LocalDate today) {
    if (subAgents.isEmpty()) return List.of();

    List<CompletableFuture<Optional<String>>> futures =
        subAgents.stream()
            .map(
                sub ->
                    CompletableFuture.supplyAsync(
                        () -> {
                          try {
                            ChatSendRequest reportRequest =
                                new ChatSendRequest(
                                    "일과 종료 배치입니다. 오늘 진행한 TODO와 학습 내용을 간략히 요약해 주세요.",
                                    ChatMode.CHAT,
                                    null,
                                    null,
                                    null);
                            ChatMessageResponse response =
                                agentChatService.sendMessage(
                                    user.getId(), sub.getId(), reportRequest);
                            upsertReport(user, sub, today, response.content());
                            log.info(
                                "👉 [배치-END] 서브 리포트 저장 완료 subAgentId={} name={}",
                                sub.getId(),
                                sub.getName());
                            return Optional.of("[" + sub.getName() + "]\n" + response.content());
                          } catch (Exception e) {
                            log.warn(
                                "👉 [배치-END] 서브 리포트 수집 실패 subAgentId={} reason={}",
                                sub.getId(),
                                e.getMessage());
                            return Optional.<String>empty();
                          }
                        }))
            .toList();

    return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
        .thenApply(
            v ->
                futures.stream()
                    .map(CompletableFuture::join)
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .toList())
        .join();
  }

  private void generateAndSaveMainReport(
      UserAccount user, AgentRole mainAgent, List<String> subReportSummaries, LocalDate today) {
    try {
      String subContext =
          subReportSummaries.isEmpty()
              ? ""
              : "\n\n[서브 에이전트 오늘의 리포트]\n" + String.join("\n\n", subReportSummaries);

      ChatSendRequest mainEndRequest =
          new ChatSendRequest(
              "일과 종료 배치입니다." + subContext + "\n\n오늘 전체 진행 내용을 요약하고, 내일 우선순위 TOP3를 간단히 정리해 주세요.",
              ChatMode.CHAT,
              null,
              null,
              null);

      ChatMessageResponse response =
          agentChatService.sendMessage(user.getId(), mainAgent.getId(), mainEndRequest);
      upsertReport(user, mainAgent, today, response.content());
      log.info("👉 [배치-END] 메인 에이전트 리포트 저장 완료 mainAgentId={}", mainAgent.getId());
    } catch (Exception e) {
      log.warn(
          "👉 [배치-END] 메인 에이전트 리포트 생성 실패 mainAgentId={} reason={}",
          mainAgent.getId(),
          e.getMessage());
    }
  }

  private void upsertReport(UserAccount user, AgentRole agent, LocalDate today, String content) {
    reportRepository
        .findByUserAccount_IdAndAgentRole_IdAndReportDate(user.getId(), agent.getId(), today)
        .ifPresentOrElse(
            existing -> {
              existing.setContent(content);
              reportRepository.save(existing);
            },
            () -> reportRepository.save(new Report(user, agent, today, content)));
  }

  /** 특정 날짜의 모든 리포트 조회. */
  public List<ReportResponse> getReportsByDate(Long userId, LocalDate date) {
    return reportRepository.findByUserAccountIdAndReportDate(userId, date).stream()
        .map(ReportResponse::from)
        .toList();
  }

  /** 특정 에이전트의 최근 N개 리포트 조회 (Sliding Window). */
  public List<ReportResponse> getRecentReports(Long userId, Long agentId, int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 30));
    return reportRepository
        .findRecentByUserAndAgent(
            userId, agentId, org.springframework.data.domain.PageRequest.of(0, safeLimit))
        .stream()
        .map(ReportResponse::from)
        .toList();
  }

  public record ReportResponse(
      Long id,
      Long agentRoleId,
      String agentName,
      String agentRoleType,
      LocalDate reportDate,
      String content,
      LocalDateTime createdAt) {

    public static ReportResponse from(Report report) {
      return new ReportResponse(
          report.getId(),
          report.getAgentRole().getId(),
          report.getAgentRole().getName(),
          report.getAgentRole().getRoleType().name(),
          report.getReportDate(),
          report.getContent(),
          report.getCreatedAt());
    }
  }
}
