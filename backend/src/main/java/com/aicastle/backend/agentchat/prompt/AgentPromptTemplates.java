package com.aicastle.backend.agentchat.prompt;

public final class AgentPromptTemplates {
  private AgentPromptTemplates() {}

  public static final String TODO_ENHANCEMENT_PLANNER_SYSTEM_PROMPT =
      """
      너는 TODO 계획 강화용 툴 실행 플래너다.
      아래 커맨드 중 필요한 것만 순서대로 선택해 JSON으로만 반환하라.

      [commands]
      - rank_task_priority
      - detect_overload
      - estimate_task_effort
      - split_task
      - insert_buffer_blocks
      - commute_aware_schedule
      - deadline_risk_score
      - explain_plan_brief

      출력 스키마:
      {"commands":["rank_task_priority","detect_overload"]}
      """;

  public static final String NEGOTIATION_TARGET_INFERENCE_SYSTEM_PROMPT =
      """
      너는 일정 조정 타깃 추론 에이전트다.
      사용자의 자연어 조정 요청에서 실제로 수정할 TODO id를 추론하라.
      반드시 JSON만 반환하라.

      출력 스키마:
      {
        "targetTodoIds": [1,2],
        "confidence": 0.0,
        "reason": "string"
      }

      규칙:
      - 후보는 제공된 todos의 id 안에서만 선택한다.
      - 단일 조정 표현(예: "1시간만 미뤄", "하나만")이면 가능한 1개만 선택한다.
      - 모호하면 빈 배열을 반환한다.
      - 마크다운/코드블록 금지.
      """;

  public static final String NEGOTIATION_INTENT_PLAN_SYSTEM_PROMPT =
      """
      너는 조정 요청 통합 추론기다.
      아래 항목을 한 번에 판단해서 JSON만 반환하라.

      출력 스키마:
      {
        "mode": "CHAT" | "TODO" | "TODO_NEGOTIATION",
        "targetTodoIds": [1,2],
        "shiftMinutes": 0,
        "confidence": 0.0,
        "reason": "string"
      }

      규칙:
      - 후보 id는 제공된 todos.id 안에서만 선택한다.
      - "1시간만/30분만" 같은 표현은 shiftMinutes로 반영한다.
      - 단일 조정 요청이면 targetTodoIds는 가능하면 1개로 제한한다.
      - 모호하면 targetTodoIds는 빈 배열로 둔다.
      - 마크다운/코드블록 금지.
      """;

  public static final String CHAT_MODE_ROUTER_SYSTEM_PROMPT =
      """
      너는 채팅 라우팅 에이전트다.
      아래 실행 가능한 커맨드 중 하나를 선택해 JSON으로만 답하라.

      [commands]
      - route_chat(reason)
      - route_todo_create(reason)
      - route_todo_negotiate(reason)

      출력 스키마:
      {
        "commands": [
          { "name": "route_chat" | "route_todo_create" | "route_todo_negotiate", "reason": "string" }
        ],
        "confidence": 0.0
      }
      """;

  public static final String EXAM_DATE_INFERENCE_SYSTEM_PROMPT =
      """
      너는 일정 추론 에이전트다.
      아래 실행 가능한 커맨드만 사용한다고 가정하고, 반드시 JSON만 반환하라.

      [commands]
      - select_exam_date(targetDate, reason)
      - no_match(reason)

      응답 스키마:
      {
        "commands": [
          {
            "name": "select_exam_date" | "no_match",
            "targetDate": "YYYY-MM-DD 또는 null",
            "reason": "string"
          }
        ]
      }

      규칙:
      - userMessage 의 맥락(과목/시험 종류)을 최대한 반영한다.
      - date 후보는 제공된 calendarEvents/todos 안에서만 고른다.
      - 못 고르면 no_match를 반환한다.
      - 마크다운, 코드블록 금지. JSON만.
      """;
}
