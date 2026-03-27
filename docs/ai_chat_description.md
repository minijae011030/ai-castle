# 💬 AI Chat / TODO / 조정 오케스트레이션 설계 (2026-03 기준)

본 문서는 현재 AI Castle 채팅 시스템의 실제 동작을 기준으로,  
**모드 자동 라우팅, TODO 생성 툴 루프, 일정 조정 권한 정책**을 하나로 정리한 최신 스펙입니다.

---

## 1) 핵심 원칙

- 사용자는 채팅창에서 자연어로만 요청한다. (`mode` 수동 선택 제거)
- 서버는 AI 라우터로 의도를 분류하고, 해당 실행 루프를 자동 선택한다.
- 캘린더(HITL)와 고정 일정은 항상 절대 제약으로 우선한다.
- TODO 소유권(`agentId`)은 보존한다. (시간 조정은 가능, 소유 에이전트 변경은 금지)

---

## 2) 모드 자동 라우팅

### 입력
- 사용자 메시지
- 이미지 첨부 여부
- 협상 컨텍스트(`negotiationTodos`) 존재 여부

### 출력
- `CHAT`
- `TODO`
- `TODO_NEGOTIATION`

### 라우팅 정책
- `negotiationTodos`가 있으면 `TODO_NEGOTIATION` 우선
- 이미지가 있으면 `CHAT` 우선
- 그 외는 AI 라우터가 커맨드 JSON으로 결정
  - `route_chat`
  - `route_todo_create`
  - `route_todo_negotiate`

> 구현: `AgentChatPlanningSupport.routeChatMode()`

---

## 3) TODO 생성 루프 (Tool Loop)

### 기본 단계
1. 날짜 범위 해석
2. 조회 범위 확장(필요 시 시험일 추론)
3. `get_calendar_events`
4. `get_todos`
5. `get_todos_by_agent`
6. `get_user_constraints`

### 강화 단계 (AI가 커맨드 선택)
- AI가 실행할 추가 커맨드 목록을 JSON으로 계획:
  - `rank_task_priority`
  - `detect_overload`
  - `estimate_task_effort`
  - `split_task`
  - `insert_buffer_blocks`
  - `commute_aware_schedule`
  - `deadline_risk_score`
  - `explain_plan_brief`

- 서버가 계획된 커맨드를 순서대로 실행하고 결과를 컨텍스트에 병합
- 최종적으로 Structured JSON TODO 응답 생성

> 구현:  
> - `AgentChatPlanningSupport.planTodoEnhancementCommands()`  
> - `AgentChatPlanningSupport.executeTodoEnhancementCommands()`  
> - `AgentChatPlanningSupport.runTodoToolLoop()`

---

## 4) 진행 문구(Progress Notes) 정책

- TODO 응답 전, 진행 단계는 버블 위 회색 문구로 노출한다.
- 진행 문구는 고정 문자열이 아니라 `plannedCommands` 기반 동적 생성.
- 저장 시에도 동일 문구를 `progressNotes`로 영속화한다. (새로고침 후 유지)

> 구현: `AgentChatPlanningSupport.buildTodoProgressNotes()`

---

## 5) 시험일/날짜 추론 정책

- “시험 전날” 같은 요청에서 날짜가 명시되지 않은 경우:
  - 캘린더/기존 TODO 후보를 조회
  - AI 추론 커맨드(`select_exam_date` / `no_match`)로 시험일 선택
  - 조회 범위를 `today ~ examDate-1`로 확장
- 같은 요청 내 중복 추론 방지를 위해 짧은 TTL 캐시 사용

---

## 6) 조정(Reschedule) 권한 정책

### 권장 정책 (확정)
- `MAIN` 에이전트: 모든 서브 TODO 조정 가능
- `SUB` 에이전트: 본인 소유 TODO만 조정 가능

### 강제해야 할 서버 가드
- apply 직전 소유권 검증
  - `todo.agentId`는 변경 불가
  - 권한 밖 TODO 포함 시 reject(초기엔 전체 reject 권장)

### 채팅방 분리와 실행 권한 분리
- 채팅방은 에이전트별로 분리 유지 가능
- 조정 실행은 내부적으로 권한 정책에 따라 메인/서브 처리

---

## 7) 에이전트 툴 API 목록 (현재)

### 기존
- `GET /api/agent-tools/calendar-events`
- `GET /api/agent-tools/todos`
- `GET /api/agent-tools/user-constraints`
- `POST /api/agent-tools/reschedule/simulate`
- `POST /api/agent-tools/reschedule/validate`
- `POST /api/agent-tools/reschedule/apply`
- `POST /api/agent-tools/reschedule/rollback`
- `POST /api/agent-tools/reschedule/explain`

### 확장
- `POST /api/agent-tools/time-preference`
- `POST /api/agent-tools/energy-curve`
- `POST /api/agent-tools/task-effort`
- `POST /api/agent-tools/split-task`
- `POST /api/agent-tools/rank-priority`
- `POST /api/agent-tools/detect-overload`
- `POST /api/agent-tools/insert-buffer`
- `POST /api/agent-tools/commute-aware`
- `POST /api/agent-tools/deadline-risk`
- `POST /api/agent-tools/negotiation-options`
- `POST /api/agent-tools/apply-with-safeguard`
- `POST /api/agent-tools/explain-brief`

---

## 8) 로깅 관측성 규칙

- 툴 실행 로그는 `👉 [TOOL:...]`
- 라우팅/추론/플래닝 로그는 `🐰 [...]`
- TODO 루프 디버깅 시 최소 확인 항목:
  - 라우팅 결과
  - 조회 범위 결정
  - `plannedCommands`
  - 각 `TOOL` 실행 로그

---

## 9) 프론트 UX 기준

- 일반 채팅 입력은 단일 입력창만 유지 (모드 드롭다운 제거)
- 진행 문구는 버블 본문이 아니라 상단 회색 영역에 노출
- 협상 요청은 별도 패널 없이도 자연어로 유도 가능하되,
  초기에는 확인 단계(초안 -> 사용자 승인 -> 적용) 권장

---

## 10) 다음 작업 우선순위

1. 조정 권한 가드(메인/서브 소유권 검증) 서버 강제
2. 조정 의도 자동감지 시 그룹/하루/단일 타깃 해석 고도화
3. 조정 옵션 A/B/C 제시 후 사용자 선택 커밋 플로우 정식화
4. `routeChatMode` 출력도 strict schema 기반으로 고정(파싱 안정성 향상)

