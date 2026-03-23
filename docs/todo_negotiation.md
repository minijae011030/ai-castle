# TODO 조정 기능 설계서

## 1) 목표

- 사용자가 "오늘/이번 주가 너무 빡빡하다"는 피드백을 주면, AI가 선택된 TODO를 기준으로 현실적인 재배치안을 제안한다.
- 조정은 별도 상세 페이지보다 채팅 맥락 안에서 빠르게 처리한다.
- 결과는 최종 일정 스냅샷으로 저장하여 캘린더/채팅에서 일관되게 보여준다.

---

## 2) 핵심 UX 방향

### 2.1. 위치

- 에이전트 채팅 화면의 우측 패널을 "TODO 워크벤치"로 사용한다.
- 해당 에이전트와 연관된 TODO를 날짜와 무관하게 하나의 리스트에서 다중 선택할 수 있어야 한다.

### 2.2. 선택 방식

- 기본: 카드별 체크박스 선택
- 보조: 필터 결과 전체 선택
- 선택 후 하단 고정 액션바에서 조정 요청

### 2.3. 사용자 흐름

1. 사용자가 우측 TODO 워크벤치에서 1개 또는 여러 개 TODO 선택
2. `조정 요청` 클릭
3. 모달에서 사유 입력
   - 예: "이번 주가 너무 빡빡해요", "집중 시간이 1시간밖에 없어요"
4. AI가 옵션 A/B/C 제안
5. 사용자가 옵션 적용/재요청/직접수정 선택
6. 적용 시 TODO 상태/일정 반영 및 캘린더 동기화

---

## 3) 프론트엔드 요구사항

## 3.1. 우측 패널(TODO 워크벤치)

- 필터:
  - 기간(오늘/이번 주/커스텀)
  - 상태(TODO/NEGOTIATING/RESCHEDULED)
  - 키워드 검색
- 리스트 항목:
  - 체크박스
  - 제목
  - 날짜/시간
  - 우선순위
  - 상태
- 액션:
  - 조정 요청
  - 선택 해제
  - 전체 선택

### 3.2. 조정 모달

- 선택된 TODO 요약 표시
- 사유 입력(프리셋 + 자유입력)
- 제약조건 선택(선택):
  - 하루 최대 집중시간
  - 특정 날짜 제외
  - 마감 유지 항목

### 3.3. 제안 결과 UI

- 옵션 A/B/C 카드
- 각 옵션에 표시:
  - 요약
  - 변경 항목(before/after)
  - 예상 부담 감소율
  - 리스크
- 버튼:
  - 이 안 적용
  - 다시 제안
  - 직접 수정

---

## 4) 백엔드 요구사항

### 4.1. 조정 API (MVP)

- `POST /api/todo/negotiations/propose`
  - 입력: `todoIds[]`, `reason`, `constraints(optional)`
  - 출력: `options[]` (A/B/C)

- `POST /api/todo/negotiations/{negotiationId}/accept`
  - 입력: `optionId`
  - 동작: 선택안 기준으로 TODO 일정/상태 반영 (트랜잭션)

- `POST /api/todo/negotiations/{negotiationId}/retry`
  - 입력: `reason`, `constraints(optional)`
  - 동작: 추가 조건으로 재제안 생성

### 4.2. 상태 전이

- TODO
  - `TODO` -> `NEGOTIATING` -> `RESCHEDULED` -> `DONE`

### 4.3. 조정 이력 저장(권장)

- 테이블 예시: `todo_negotiation`
  - `id`
  - `user_id`
  - `agent_id`
  - `selected_todo_ids_json`
  - `reason`
  - `constraints_json`
  - `proposal_json`
  - `selected_option_id`
  - `status` (`PROPOSED`, `ACCEPTED`, `REJECTED`)
  - `created_at`, `updated_at`

---

## 5) AI 출력 규격 (Structured JSON)

- 텍스트 설명만 받지 말고 반드시 구조화된 JSON으로 받는다.
- 예시 스키마(요약):
  - `summary: string`
  - `options: Array<NegotiationOption>`
    - `id: string`
    - `title: string`
    - `loadReductionPercent: number`
    - `risk: "LOW" | "MEDIUM" | "HIGH"`
    - `changes: Array<NegotiationChange>`
      - `todoId: number`
      - `before: { scheduledDate, startAt, endAt, priority }`
      - `after: { scheduledDate, startAt, endAt, priority }`

---

## 6) 제약/정책

- HITL 우선: 사용자 캘린더 고정 이벤트와 충돌하면 해당 옵션은 폐기
- 마감 임박/고우선순위 TODO는 이동 최소화
- 변경 적용 전 충돌 검사 필수
- 부분 실패 시 전체 롤백 또는 부분 적용 정책을 명확히 정의

---

## 7) 구현 순서 (권장)

1. Front: 우측 TODO 워크벤치 + 다중선택 + 조정 모달
2. Back: propose/accept/retry API + 기본 검증
3. AI: 조정 옵션 Structured Output 연결
4. 적용 로직: 일정 충돌 검사 + 상태 전이 + 히스토리 저장
5. 최종: 캘린더/채팅 동기화, 실패 케이스 UX 보강

---

## 8) 완료 기준(DoD)

- 여러 날짜의 TODO를 한 번에 선택해 조정 요청 가능
- 옵션 A/B/C 제안과 적용이 정상 동작
- 적용 후 TODO/캘린더 데이터 정합성 유지
- 조정 이력 조회 가능
- 실패 시 사용자에게 원인과 재시도 경로가 명확히 안내됨

---

## 9) End Batch 리포트 기반 자동 일정관리 (확장안)

### 9.1. 목표

- 하루 종료 시점(day_end_time) 기준으로 미완료/지연 TODO를 자동 집계한다.
- 서브 에이전트가 일일 리포트를 메인 에이전트에 전달한다.
- 메인 에이전트는 전체 리포트를 기반으로 다음날 제안 일정을 생성한다.
- 초기 단계에서는 자동 적용하지 않고, 사용자 승인 후 반영한다.

### 9.2. 권장 원칙

- "자동 제안 + 사용자 승인"을 기본 정책으로 사용한다.
- 자동 반영은 2단계 이후(신뢰도 확보 후)에만 제한적으로 허용한다.
- 캘린더 고정 이벤트(HITL)와 충돌하는 제안은 생성 단계에서 제외한다.

### 9.3. 배치 플로우

1. `day_end_time` 배치 트리거
2. 오늘 TODO 중 `TODO/NEGOTIATING` 상태 항목 조회
3. 서브 에이전트별 리포트 생성
   - 미완료 이유 요약
   - 내일 재배치/분할 제안
4. 메인 에이전트가 서브 리포트 집계
   - 우선순위/마감/사용자 제약 반영
   - 다음날 통합 제안안 생성
5. 사용자에게 "내일 일정 제안" 카드 노출
6. 사용자 `승인/수정/거절` 선택

### 9.4. 데이터 구조(초안)

- `sub_agent_daily_report`
  - `id`
  - `user_id`
  - `agent_id`
  - `report_date`
  - `missed_todo_ids_json`
  - `reason_summary`
  - `suggested_adjustments_json`
  - `created_at`

- `main_agent_daily_plan_proposal`
  - `id`
  - `user_id`
  - `proposal_date`
  - `source_report_ids_json`
  - `proposal_json` (moves/splits/priority changes)
  - `status` (`PROPOSED`, `APPROVED`, `REJECTED`, `APPLIED`)
  - `created_at`
  - `approved_at`

### 9.5. 제안 JSON 예시(요약)

- `summary: string`
- `loadAnalysis`
  - `todayPlannedMinutes`
  - `todayCompletedMinutes`
  - `carryOverMinutes`
- `proposals[]`
  - `id`
  - `title`
  - `changes[]` (todo 단위 before/after)
  - `risk`
  - `expectedRecoveryDays`

### 9.6. 구현 단계

- Phase 1 (MVP)
  - 미완료 TODO 집계 + 서브 리포트 생성
  - 메인 제안 1개 생성
  - 사용자 승인 후 수동 반영

- Phase 2
  - 옵션 A/B/C 다중 제안
  - 일정 충돌 자동 해소 로직 강화
  - 승인 시 일괄 반영 자동화

- Phase 3
  - 사용자 성향 반영(집중도/피로도/선호 시간대)
  - 제안 품질 피드백 루프(학습형 프롬프트)

### 9.7. 리스크와 대응

- 리스크: 잘못된 자동 이동으로 사용자 신뢰 하락  
  -> 대응: 초기에는 자동 적용 금지, 승인 기반 유지

- 리스크: 일정 충돌 누락  
  -> 대응: 적용 전 충돌 검사 필수 + 충돌 항목 차단

- 리스크: 제안이 과도하게 보수적/공격적  
  -> 대응: 감량률 상한/하한 가드레일 도입
