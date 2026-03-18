# 💬 AI Chat & TODO Mode 설계 (Agent Context, Memory, Plan)

본 문서는 AI Castle의 에이전트 채팅 기능을 **“대화 로그”**와 **“상태(state)”**로 분리하여,
대화가 길어져도 중요한 정보를 놓치지 않고(요약의 요약 방지), 안정적으로 **할 일(TODO) 생성/유지**가 가능하도록 하는 설계를 정의합니다.

---

## 1. 문제 정의

- 채팅이 길어질수록 모든 내용을 매 요청에 포함할 수 없고(토큰/비용 제한),
- “요약 → 요약”을 누적하면 정보 손실이 발생하여 중요한 제약/결정/계획을 놓칠 수 있습니다.

따라서 다음 4가지를 분리하여 관리합니다.

- **에이전트 정보**: 용도/제약/말투/규칙 (system prompt 확장)
- **할 일 목록 스냅샷(Plan JSON 1개)**: 에이전트가 만들어준 최신 TODO 상태
- **고정 메모리(Pinned Memory 최대 10개)**: 사용자가 직접 추가/삭제하는 “절대 잊으면 안 되는” 항목
- **최근 n턴 대화(Sliding Window)**: 최신 대화 일부만 포함

---

## 2. 모드(Mode) 정의

### 2.1 Chat Mode (`CHAT`)
- 목적: 자연스러운 대화/질의응답
- 출력: 마크다운 텍스트 중심
- 상태 업데이트: 기본은 최소화(필요 시 사용자 승인 기반으로 pinned memory에만 반영)

### 2.2 Todo Mode (`TODO`)
- 목적: 사용자의 요청을 실행 가능한 TODO로 전환하고, 기존 TODO Plan을 갱신
- 출력: 마크다운 + (권장) 구조화된 JSON(최소한 Plan Snapshot은 JSON으로 유지)
- 상태 업데이트: Plan Snapshot(최신 1개)을 갱신하거나 diff로 수정

> 현재 구현은 `ChatSendRequest`에 `mode(CHAT|TODO)`를 추가하고, system prompt에 모드별 규칙을 주입하는 방식으로 시작합니다.

---

## 3. 컨텍스트 주입 순서 (요청마다 고정)

OpenAI(또는 LLM) 호출 시 메시지 구성은 아래 순서를 강제합니다.

1) **System: 에이전트 정보**
   - 역할/용도/제약/말투/금지사항/품질 기준
2) **System(or User): Plan Snapshot (JSON 1개)**
   - “현재 TODO 상태”의 최신본을 그대로 제공
3) **System(or User): Pinned Memory (최대 10개)**
   - 사용자가 직접 고정한 중요한 사실/선호/제약
4) **Recent Conversation (last N turns)**
   - USER/ASSISTANT 최근 N개만 포함 (슬라이딩 윈도우)
5) **User: 이번 사용자 메시지**

이 구조는 다음을 보장합니다.
- “중요한 것(메모리/플랜)”은 대화 길이와 무관하게 항상 컨텍스트에 포함
- 최근 대화는 최소한만 포함하여 토큰을 통제

---

## 4. 데이터 모델(권장)

### 4.1 Chat Log (불변)
- `chat_message`
  - 원문 전체를 저장 (감사/복구/검색 용도)

### 4.2 Pinned Memory (최대 10개, FIFO 금지)
- `agent_pinned_memory`
  - `user_account_id`
  - `agent_role_id`
  - `id`
  - `content`
  - `created_at`
  - (optional) `source_message_id` (어떤 채팅에서 나온 메모리인지 추적)

정책:
- 최대 10개를 초과하면 **저장 거부** (사용자가 직접 삭제 후 추가)
- 각 항목은 길이 제한 권장 (예: 300~500자)

### 4.3 Plan Snapshot (최신 JSON 1개)
- `agent_todo_plan_snapshot`
  - `user_account_id`
  - `agent_role_id`
  - `plan_json` (TEXT/JSON)
  - `updated_at`

정책:
- “히스토리”가 아니라 “현재판”을 유지
- 모델 호출 시 항상 최신 1개만 주입

---

## 4.4 Conversation Summary (AI 자동 요약, 최신 1개만 유지)

요약은 **AI가 자동으로 생성**하되, “요약의 요약”으로 인한 정보 손실을 막기 위해 다음 원칙을 강제합니다.

### 핵심 원칙
- **요약은 Memory/Plan을 대체하지 않는다.**
  - 사실/제약/계획의 정답판은 `Pinned Memory(10)`과 `Plan Snapshot(JSON 1)`이다.
- **요약은 최신 1개만 유지한다.**
  - 누적 요약(요약 → 요약) 금지. 매번 **덮어쓰기(overwrite)** 한다.
- **요약은 ‘브릿지’ 역할만 한다.**
  - 최근 N턴 슬라이딩 윈도우에 포함되지 않는 구간의 핵심 흐름을 짧게 연결한다.

### 권장 스키마(구조화 요약)
서술형 한 덩어리 대신, 아래처럼 구조화하여 정보 유실을 줄입니다.

```json
{
  "version": 1,
  "decisions": ["..."],
  "constraints": ["..."],
  "openQuestions": ["..."],
  "risks": ["..."],
  "nextActions": ["..."],
  "updatedAt": "2026-03-18T10:00:00Z"
}
```

### 생성 입력(요약 생성 시 주입)
요약 생성은 최소한 아래 정보를 입력으로 포함합니다.
- 최근 대화 일부(요약 대상 구간)
- 최신 `Plan Snapshot(JSON 1)`
- `Pinned Memory(최대 10개)`

### 갱신 타이밍(권장)
- 매 턴마다 생성 X
- 아래 조건 중 하나일 때만 생성/갱신:
  - 최근 대화가 N턴을 초과하여 컨텍스트에서 밀려나기 시작하는 시점
  - `TODO` 모드에서 Plan Snapshot이 의미 있게 변경된 시점

### 컨텍스트 주입 위치(권장)
요약은 다음 순서로 주입합니다.
- Agent info(system)
- Plan Snapshot(JSON 1)
- Pinned Memory(10)
- **Conversation Summary(1)**
- Recent N turns
- Current user message

### 저장 모델(권장)
- `agent_conversation_summary`
  - `user_account_id`
  - `agent_role_id`
  - `summary_json` (TEXT/JSON)
  - `updated_at`

---

## 5. API 설계(권장)

### 5.1 채팅
- `POST /api/chat/agents/{agentId}`
  - body: `{ content: string, mode?: 'CHAT'|'TODO' }`
  - response: message 1개(assistant)

### 5.2 채팅 히스토리(무한 스크롤)
- `GET /api/chat/agents/{agentId}?beforeId=&limit=`
  - response: `{ items, nextBeforeId, hasMore }`
  - 커서 기반 페이지네이션

### 5.3 Pinned Memory
- `GET /api/agents/{agentId}/memory`
- `POST /api/agents/{agentId}/memory` (추가)
- `DELETE /api/agents/{agentId}/memory/{memoryId}` (삭제)

### 5.4 Plan Snapshot
- `GET /api/agents/{agentId}/todo-plan`
- `PUT /api/agents/{agentId}/todo-plan` (전체 갱신) 또는 `PATCH` (diff 갱신)

---

## 6. 프론트 UI/UX(권장)

### 6.1 입력부
- Textarea(입력) 아래에
  - 모드 드롭다운(대화/투두)
  - 보내기 버튼

### 6.2 사용자 메시지 마크다운 미적용
- USER 메시지는 raw text(개행 유지)로 렌더링
- ASSISTANT만 마크다운 렌더링(코드 하이라이팅 포함)

### 6.3 무한 스크롤
- 상단 근처 스크롤 시 과거 메시지 로드
- prepend 시 스크롤 위치 보존(“점프” 방지)

---

## 7. TODO Plan(JSON) 최소 권장 스키마

아래는 “현재판”을 표현하기 위한 최소 스키마 예시입니다.

```json
{
  "version": 1,
  "title": "오늘의 계획",
  "items": [
    {
      "id": "t_001",
      "title": "코테 1문제",
      "description": "문제 풀이 + 풀이 정리",
      "estimateMinutes": 60,
      "priority": "HIGH",
      "status": "TODO"
    }
  ],
  "notes": ["시간이 부족하면 코테를 1문제로 줄이기"],
  "updatedAt": "2026-03-18T10:00:00Z"
}
```

> 실제 스키마는 `docs/todo_description.md`를 기준으로 확정하는 것을 권장합니다.

---

## 8. 운영 원칙

- **요약을 기억장치로 쓰지 않는다.**
  - 요약은 “브릿지(보조 인덱스)”이며, 핵심은 “Pinned Memory(10)” + “Plan JSON(1)” + “Recent N” 구조다.
  - 요약은 **최신 1개만 유지(덮어쓰기)** 하며, “요약의 요약”을 금지한다.
- **사용자 정의(캘린더/HITL)는 절대 진실**로 취급한다.
  - 일정/제약은 Plan Snapshot 및 system prompt 주입에 반영되어야 한다.
- **토큰 상한을 명확히 둔다.**
  - pinned 10개 + plan 1개 + summary 1개 + recent N개로 상한 관리.

