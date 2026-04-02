package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.AgentRoleRepository;
import com.aicastle.backend.repository.UserAccountRepository;
import com.aicastle.backend.service.ReportService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 배치 흐름을 수동으로 트리거해서 로그로 확인하기 위한 디버그 전용 컨트롤러. */
@RestController
@RequestMapping("/api/debug/batch")
public class DebugBatchController {

  private static final Logger log = LoggerFactory.getLogger(DebugBatchController.class);

  private final UserAccountRepository userAccountRepository;
  private final AgentRoleRepository agentRoleRepository;
  private final ReportService reportService;

  public DebugBatchController(
      UserAccountRepository userAccountRepository,
      AgentRoleRepository agentRoleRepository,
      ReportService reportService) {
    this.userAccountRepository = userAccountRepository;
    this.agentRoleRepository = agentRoleRepository;
    this.reportService = reportService;
  }

  /**
   * START 배치 수동 트리거. POST /api/debug/batch/trigger?type=START POST
   * /api/debug/batch/trigger?type=END
   */
  @PostMapping("/trigger")
  public ResponseEntity<ResultResponse<String>> trigger(
      @RequestParam(defaultValue = "START") String type) {

    LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    List<UserAccount> users = userAccountRepository.findAll();
    List<AgentRole> mainAgents =
        agentRoleRepository.findByRoleTypeOrderByNameAsc(AgentRoleType.MAIN);

    if (users.isEmpty() || mainAgents.isEmpty()) {
      String msg =
          "유저 또는 MAIN 에이전트가 없습니다. users=" + users.size() + " mainAgents=" + mainAgents.size();
      log.warn("👉 [디버그배치] {}", msg);
      return ResponseEntity.ok(ResultResponse.success(msg));
    }

    List<String> results = new ArrayList<>();
    for (UserAccount user : users) {
      for (AgentRole mainAgent : mainAgents) {
        log.info(
            "👉 [디버그배치] {} 트리거 시작 userId={} mainAgentId={} date={}",
            type,
            user.getId(),
            mainAgent.getId(),
            today);
        try {
          if ("END".equalsIgnoreCase(type)) {
            reportService.runEndBatch(user, mainAgent, today);
          } else {
            reportService.runMainStartBatch(user, mainAgent, today);
            reportService.runSubStartBatch(user, mainAgent, today);
          }
          String result = type + " 완료 userId=" + user.getId() + " mainAgentId=" + mainAgent.getId();
          results.add(result);
          log.info("👉 [디버그배치] {} ✅ {}", type, result);
        } catch (Exception e) {
          String result = type + " 실패 userId=" + user.getId() + " reason=" + e.getMessage();
          results.add(result);
          log.warn("👉 [디버그배치] {} ❌ {}", type, result);
        }
      }
    }

    return ResponseEntity.ok(ResultResponse.success(String.join(" | ", results)));
  }
}
