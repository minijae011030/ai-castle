package com.aicastle.backend.scheduler;

import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import com.aicastle.backend.service.ReportService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 사용자 day_start_time/day_end_time 기준으로 에이전트 자동 배치를 실행한다. */
@Component
public class AgentAutoBatchScheduler {
  private static final Logger log = LoggerFactory.getLogger(AgentAutoBatchScheduler.class);
  private static final ZoneId KST_ZONE_ID = ZoneId.of("Asia/Seoul");

  private final UserAccountRepository userAccountRepository;
  private final AgentRoleRepository agentRoleRepository;
  private final ReportService reportService;
  private final Map<String, LocalDate> triggeredDates = new ConcurrentHashMap<>();

  @Value("${app.scheduler.agent-batch.enabled:true}")
  private boolean schedulerEnabled;

  @Value("${app.scheduler.agent-batch.default-main-agent-id:0}")
  private long configuredMainAgentId;

  public AgentAutoBatchScheduler(
      UserAccountRepository userAccountRepository,
      AgentRoleRepository agentRoleRepository,
      ReportService reportService) {
    this.userAccountRepository = userAccountRepository;
    this.agentRoleRepository = agentRoleRepository;
    this.reportService = reportService;
  }

  /** 1분마다 사용자별 시작/종료 시각을 확인해서 자동 채팅을 트리거한다. */
  @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul")
  public void runMinutePolling() {
    if (!schedulerEnabled) return;
    LocalDateTime nowDateTime = LocalDateTime.now(KST_ZONE_ID).truncatedTo(ChronoUnit.MINUTES);
    LocalDate today = nowDateTime.toLocalDate();
    LocalTime nowTime = nowDateTime.toLocalTime();

    List<AgentRole> mainAgents = resolveMainAgents();
    if (mainAgents.isEmpty()) {
      log.warn("👉 [자동배치] MAIN 에이전트를 찾지 못해 스케줄 실행을 건너뜁니다.");
      return;
    }

    for (UserAccount user : userAccountRepository.findAll()) {
      if (user == null || user.getId() == null) continue;
      LocalTime dayStartTime = truncateToMinute(user.getDayStartTime());
      LocalTime dayEndTime = truncateToMinute(user.getDayEndTime());
      if (dayStartTime == null || dayEndTime == null) continue;

      if (nowTime.equals(dayStartTime)) {
        for (AgentRole mainAgent : mainAgents) {
          if (mainAgent == null || mainAgent.getId() == null) continue;
          triggerStartBatchIfNeeded(user, mainAgent, today);
        }
      }
      if (nowTime.equals(dayEndTime)) {
        for (AgentRole mainAgent : mainAgents) {
          if (mainAgent == null || mainAgent.getId() == null) continue;
          triggerEndBatchIfNeeded(user, mainAgent, today);
        }
      }
    }
  }

  private void triggerStartBatchIfNeeded(UserAccount user, AgentRole mainAgent, LocalDate today) {
    String dedupeKey = "START::" + user.getId() + "::" + mainAgent.getId();
    if (today.equals(triggeredDates.get(dedupeKey))) return;
    try {
      // 오늘 날짜/일정/어제 미완료 항목을 컨텍스트로 메인 에이전트에 발송한다.
      reportService.runMainStartBatch(user, mainAgent, today);
      // 메인 에이전트 소속 서브 에이전트들에게도 TODO 생성 메시지를 병렬 발송한다.
      reportService.runSubStartBatch(user, mainAgent, today);
      triggeredDates.put(dedupeKey, today);
      log.info(
          "👉 [자동배치] START 실행 완료 userId={}, mainAgentId={}, dayStartTime={}",
          user.getId(),
          mainAgent.getId(),
          user.getDayStartTime());
    } catch (Exception e) {
      log.warn(
          "👉 [자동배치] START 실행 실패 userId={}, mainAgentId={}, reason={}",
          user.getId(),
          mainAgent.getId(),
          e.getMessage());
    }
  }

  private void triggerEndBatchIfNeeded(UserAccount user, AgentRole mainAgent, LocalDate today) {
    String dedupeKey = "END::" + user.getId() + "::" + mainAgent.getId();
    if (today.equals(triggeredDates.get(dedupeKey))) return;
    try {
      // 서브 에이전트 리포트 수집 → 메인 에이전트 최종 요약 생성 및 저장
      reportService.runEndBatch(user, mainAgent, today);
      triggeredDates.put(dedupeKey, today);
      log.info(
          "👉 [자동배치] END 실행 완료 userId={}, mainAgentId={}, dayEndTime={}",
          user.getId(),
          mainAgent.getId(),
          user.getDayEndTime());
    } catch (Exception e) {
      log.warn(
          "👉 [자동배치] END 실행 실패 userId={}, mainAgentId={}, reason={}",
          user.getId(),
          mainAgent.getId(),
          e.getMessage());
    }
  }

  private List<AgentRole> resolveMainAgents() {
    if (configuredMainAgentId > 0) {
      AgentRole configuredAgent = agentRoleRepository.findById(configuredMainAgentId).orElse(null);
      if (configuredAgent != null && configuredAgent.getRoleType() == AgentRoleType.MAIN) {
        return List.of(configuredAgent);
      }
      log.warn(
          "👉 [자동배치] configured main agent id={} 가 유효하지 않아 전체 MAIN 선택으로 폴백합니다.",
          configuredMainAgentId);
    }
    return agentRoleRepository.findByRoleTypeOrderByNameAsc(AgentRoleType.MAIN);
  }

  private LocalTime truncateToMinute(LocalTime time) {
    if (time == null) return null;
    return time.truncatedTo(ChronoUnit.MINUTES);
  }
}
