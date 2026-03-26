# 🧩 Sub-Agent Draft 자동 추천 설계

본 문서는 사용자가 “무엇을 해야 할지 모르겠어요” 같은 발화를 했을 때,  
메인 에이전트가 적절한 서브 에이전트 초안(draft)을 자동 생성/제안하는 기능을 정의합니다.

---

## 1. 목표

- 초보 사용자도 빠르게 학습/취업 준비 체계를 세팅할 수 있게 한다.
- 도메인 지식이 없는 사용자에게 메인 에이전트가 “과외쌤 조합”을 추천한다.
- 자동 생성 오작동을 막기 위해 **반드시 사용자 승인 후 생성**한다.

---

## 2. 핵심 원칙

- 메인 에이전트만 draft 추천 권한을 가진다.
- 서브 에이전트 생성은 confirm 단계 이후에만 수행한다.
- draft는 제안이며, 사용자 수정/부분 선택 생성이 가능해야 한다.
- 생성된 서브 에이전트는 특정 메인 에이전트에 1:N으로 연결된다.

---

## 3. 트리거 발화 예시

- “선생님 저 뭐해야할지 모르겠어요.”
- “취업 준비 과외 붙여주세요.”
- “자격증/코테/서류 준비를 어떻게 나누면 좋을까요?”

---

## 4. 플로우

1) 사용자 발화 수신  
2) 의도 라우팅: `SUB_AGENT_DRAFT_RECOMMEND`  
3) 메인 에이전트가 draft 리스트 생성  
4) 사용자에게 초안 카드 제시  
5) 사용자 액션
   - 전체 생성
   - 일부만 생성
   - 수정 후 생성
   - 취소
6) 승인된 draft만 실제 `AgentRole`로 생성

---

## 5. Draft 스키마 (권장)

```json
{
  "drafts": [
    {
      "name": "코테 코치",
      "domain": "CODING_TEST",
      "description": "알고리즘/자료구조 문제 풀이와 복습 담당",
      "systemPromptDraft": "출력은 JSON 우선, 시간 제약 준수, 충돌 회피",
      "priority": "HIGH",
      "expectedWorkload": "DAILY_60_90",
      "why": "취업 준비에서 코테 비중이 높고 반복 학습이 필요함"
    }
  ]
}
```

---

## 6. API 초안

## 6.1 Draft 추천

- `POST /api/agents/draft-recommendations`
- 요청:
  - `goalText`
  - `mainAgentId`
  - (optional) `userProfileSummary`
- 응답:
  - `drafts[]`

## 6.2 Draft 확정 생성

- `POST /api/agents/drafts/confirm-create`
- 요청:
  - `mainAgentId`
  - `selectedDrafts[]` (전체 or 일부)
- 응답:
  - 생성된 `agentIds[]`

---

## 7. 데이터 모델 (권장)

- `agent_draft`
  - `id`
  - `user_account_id`
  - `main_agent_id`
  - `name`
  - `domain`
  - `description`
  - `system_prompt_draft`
  - `priority`
  - `expected_workload`
  - `why`
  - `status` (`DRAFT`, `CONFIRMED`, `CANCELLED`)
  - `created_at`
  - `updated_at`

---

## 8. 권한/안전 정책

- 추천 생성(actor): MAIN only
- 최종 생성(actor): 사용자 승인 후 서버 처리
- 자동 생성 금지 (confirm 없는 commit 금지)
- 생성 시 메인-서브 연결 강제(mainAgentId 필수)

---

## 9. UI/UX 가이드

- 채팅 내 draft 카드 렌더링
  - 이름/설명/왜 필요한지/예상 부담도
- 액션 버튼
  - `전체 생성`
  - `선택 생성`
  - `수정`
  - `취소`
- 생성 전 최종 확인 모달(요약 표시)

---

## 10. 완료 기준 (DoD)

- 트리거 발화에서 draft 추천 응답이 3초 내 생성
- 사용자 승인 없이 실제 서브 에이전트 생성되지 않음
- 일부 선택 생성이 정상 동작
- 생성 후 메인-서브 연결 및 채팅 리스트에 즉시 반영
