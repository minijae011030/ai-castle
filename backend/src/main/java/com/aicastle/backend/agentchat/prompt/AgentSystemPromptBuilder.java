package com.aicastle.backend.agentchat.prompt;

import com.aicastle.backend.dto.ChatDtos.ChatMode;
import com.aicastle.backend.entity.AgentRole;
import com.aicastle.backend.entity.AgentRoleType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public class AgentSystemPromptBuilder {

  public String build(AgentRole agent, ChatMode mode, ZoneId zoneId) {
    LocalDate today = LocalDate.now(zoneId);
    LocalTime now = LocalTime.now(zoneId).withNano(0);
    String roleLabel = agent.getRoleType() == AgentRoleType.MAIN ? "메인" : "서브";
    return buildCalendarAnchor(today, now)
        + agent.getSystemPrompt()
        + "\n\n"
        + "너는 "
        + roleLabel
        + " 에이전트("
        + agent.getName()
        + ")다. 한국어로 간결하고 실행 가능하게 답하라."
        + buildModePrompt(mode);
  }

  private String buildCalendarAnchor(LocalDate today, LocalTime now) {
    return "[현재 시각 기준]\n"
        + "- 오늘 날짜(Asia/Seoul): "
        + today
        + "\n"
        + "- 현재 시각: "
        + now
        + "\n"
        + "- TODO/일정의 scheduledDate, startAt, endAt는 위 오늘을 기준으로 현실적인 날짜·시간을 사용하라. "
        + "학습 데이터에 묶인 과거 연도(예: 2024)를 사용하지 마라.\n\n";
  }

  private String buildModePrompt(ChatMode mode) {
    if (mode == ChatMode.TODO) {
      return "\n\n[모드: TODO]\n- 반드시 JSON만 출력하라. (설명 문장/마크다운/코드블록 금지)\n- 스키마: {\"text\": string, \"groupTitle\": string, \"todo\": [{\"title\": string, \"description\": string|null, \"estimateMinutes\": number|null, \"priority\": \"LOW\"|\"MEDIUM\"|\"HIGH\", \"status\": \"TODO\"|\"DONE\", \"scheduledDate\": \"YYYY-MM-DD\", \"startAt\": \"YYYY-MM-DDTHH:mm:ss\", \"endAt\": \"YYYY-MM-DDTHH:mm:ss\"}]}\n- 모든 todo 항목에 날짜/시간을 반드시 포함하라.\n- todo 항목은 짧고 측정 가능해야 한다.\n";
    }
    if (mode == ChatMode.TODO_NEGOTIATION) {
      return "\n\n[모드: TODO_NEGOTIATION]\n- 반드시 JSON만 출력하라. (설명 문장/마크다운/코드블록 금지)\n- 스키마: {\"text\": string, \"groupTitle\": string, \"todo\": [{\"title\": string, \"description\": string|null, \"estimateMinutes\": number|null, \"priority\": \"LOW\"|\"MEDIUM\"|\"HIGH\", \"status\": \"TODO\"|\"DONE\", \"scheduledDate\": \"YYYY-MM-DD\", \"startAt\": \"YYYY-MM-DDTHH:mm:ss\", \"endAt\": \"YYYY-MM-DDTHH:mm:ss\"}]}\n- 조정 요청된 TODO를 현실적으로 재배치하되, 마감/우선순위를 고려하라.\n- preferred deadline이 있으면 그 날짜를 우선 존중하라.\n- 반드시 날짜/시간이 포함된 todo[]를 반환하라.\n";
    }
    return "\n\n[모드: CHAT]\n- 자연스러운 대화로 답하라.\n";
  }
}
