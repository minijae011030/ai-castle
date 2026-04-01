# Front

## 현재 한 것

- [x] ~~프로젝트 셋업 (React, Vite, TanStack Router, Tailwind, shadcn/ui)~~
- [x] ~~홈 페이지 + 백엔드 헬스 체크 버튼~~
- [x] ~~health-service, types/health.type.ts~~
- [x] ~~frontend_rules.md 타입 규칙 추가 (3.2, types 도메인별)~~
- [x] ~~로그인 (JWT 발급, 로그인 페이지, 보호 라우트)~~
- [x] ~~캘린더 이벤트 API 연동 (목록/추가 화면)~~
- [x] ~~사용자 일과 시간 설정 화면 (day_start_time, day_end_time)~~
- [x] 캘린더 오른쪽 컬럼 UI 리팩토링 (정기일정/일정/할 일 개별 카드 + 비어 있을 때 최소 문구만 표시)
- [x] 정기일정/일정/할 일 데이터 로딩 상태 및 빈 목록 처리 통일 (pending + length 0일 때 섹션 숨김)
- [x] 정기일정/일정/할 일을 하나의 탭형 다이얼로그에서 추가할 수 있는 공통 폼 구현 (정기일정/일정/Todo 생성 연동)
- [x] 401 전역 처리 마무리 (refresh 엔드포인트 permitAll 반영 이후, 프론트 인터셉터·로그인 흐름 E2E 검증)
- [x] 서브 에이전트 관리 UI (Agent_Role CRUD + pinned memory CRUD)
- [x] 서브 에이전트 채팅 TODO 모드 응답 렌더링(`text + todo[]`)
- [x] TODO 편집/부분삭제/추가 및 캘린더 등록(우측 편집 패널 → `createSchedule` 호출)
- [x] 캘린더에서 TODO 실행 결과(todo[]) 렌더링
- [x] 이미지 업로드 + 이미지 채팅 UI
  - 채팅 입력에 이미지 첨부(1장/다장 선택 정책 필요)
  - 이미지가 포함된 메시지를 OpenAI에 vision 입력으로 함께 전달
- [x] 메인 에이전트 채팅 UI
  - ~~AI 대시보드 페이지: 메인 에이전트와 1:1 대화~~
  - ~~"오늘 할 일 제안" 메시지와 실제 Todo 목록을 함께 보여주는 레이아웃~~
  - 채팅 메시지 단에서 "오늘 이거 좀 많은데 줄여주세요" 같은 조정 발화가 일어나도록 UX 설계
  - 조정 발화 시 선택 Todo IDs를 포함해 조정 API로 연결
- [x] 메인/서브 연결 UI에서 서브 생성 시 메인 1개 필수 선택 흐름 완성
- [x] /agents 채팅 입력 모드 드롭다운 제거 (자연어 단일 입력)
- [x] TODO 진행 문구를 버블 위 회색 상태로 고정 + 새로고침 유지
- [x] 진행 문구를 plannedCommands 기반 동적 문구로 전환
- [x] 서브 에이전트 -> 메인 에이전트 연결 UI
  - 메인 에이전트 아래에 서브 에이전트가 있는 그림으로
  
## 해야 할 것

- [ ] 선택 TODO 조정 UX (MVP)
  - [x] Todo 목록에서 단일/다중 선택 + `조정 요청` 버튼
  - [x] 조정 요청 모달: 기본 문구(예: "오늘 너무 힘들어요") + 자유 입력
  - [ ] 제안 카드 UI: A/B/C 안 비교(감량률, 이월 항목, 리스크)
  - [ ] 액션: `이 안 적용`, `다시 제안`, `직접 수정`
- [ ] 캘린더 화면에서 TODO 응답을 동일한 "편집 패널"로 이어서 수정/부분삭제/등록(채팅 패널과 UX 통합)
- [ ] 자동 배치 상태 카드(시작/종료 예정, 최근 실행 결과) 노출
- [ ] 리포트/피드백 화면 (End Batch 요약)
- [ ] 조정패널 제거 여부 결정 후 UX 정리
  - [x] 자연어 조정(패널 없이) 플로우 실험
  - [ ] 애매한 타깃(group/day/single) 확인 질문 UX
- [ ] 메인 에이전트의 서브 에이전트 TODO 등록 UX
  - [ ] 서브 에이전트 선택 + TODO 등록 권한 안내/경고 UI
  - [ ] 등록 대상이 본인/서브인지 명확히 표시 (배지/라벨)
  - [ ] 등록 후 해당 서브 채팅/캘린더에 반영 상태 피드백
- [ ] TODO 반복 등록(정기 TODO) UX
  - [ ] TODO 생성 다이얼로그에 반복 옵션(요일/기간/시간) 추가
  - [ ] 반복 TODO 미리보기(생성 예정 건수/범위) 표시
  - [ ] 반복 TODO와 일반 정기일정의 구분 표시 규칙 정리
- [ ] 홈 대시보드 구축 (학습 분석 중심)
  - [ ] KPI 카드: 오늘 집중 시간, 총 학습 시간, 남은 가능 시간
  - [ ] 주간 히트맵 + 과목 비중 도넛 차트
  - [ ] 과목별 막대/추세 차트 (일/주/월)
  - [ ] AI 인사이트 카드: 과부하 경고, 내일 예측 부하, 추천 액션
  - [ ] 에이전트별 기여도 위젯 + 조정 히스토리 요약
  - [ ] 스펙 문서: `docs/dashboard_description.md` 기준으로 구현
- [ ] 메인 에이전트 기반 서브에이전트 Draft 자동 추천
  - [ ] 트리거 발화 감지(예: "뭐해야할지 모르겠어요", "과외 붙여주세요")
  - [ ] 메인 에이전트가 sub-agent draft 리스트 제안(name/description/systemPromptDraft/why)
  - [ ] 사용자 승인 후 생성(자동 커밋 금지, confirm 단계 필수)
  - [ ] 일부 선택 생성/수정 후 생성 UX 지원
  - [ ] 스펙 문서: `docs/sub_agent_draft_description.md` 기준으로 구현

> 결정: "조정"은 별도의 Todo 목록/상세 페이지가 아니라 **메인/서브 에이전트 채팅 화면에서 대화로만 진행**한다.  
> Todo는 조정 결과가 반영된 **최종 일정 스냅샷**을 저장·표시하는 역할에 집중한다.

---

# Back

## 현재 한 것

- [x] ~~DB 설계 (JPA 엔티티: UserAccount, AgentRole, CalendarEvent, Todo, Report)~~
- [x] ~~Repository 레이어~~
- [x] ~~MySQL env 설정 (application.properties + .env, direnv)~~
- [x] ~~ResultResponse + 전역 예외 처리 + GET /api/health~~
- [x] ~~CORS 설정~~
- [x] ~~로그인/회원가입 API + JWT 발급, 인증 필터~~
- [x] ~~캘린더 이벤트 CRUD API (Controller, Service, DTO)~~
- [x] ~~UserAccount에 day_start_time, day_end_time 필드 + 설정 API (GET/PATCH)~~
- [x] ~~Todo CRUD API (목록/상세/상태 변경, Main Agent 생성 연동은 이후)~~
- [x] ~~메인 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/main, 더미 응답으로 우선 구현)~
  - 더미 응답 기반 UI/연동 스켈레톤 (TODO 오케스트레이션/조정 JSON 미구현)
- [x] ~~서브 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/agents/{agentId}, 더미 응답으로 우선 구현)~~
  - OpenAI 연동 + TODO 모드 Structured Output(`json_schema`)로 `todo[]` 파싱
  - `todo[]`에 `scheduledDate/startAt/endAt` 포함하도록 스키마 확정
- [x] 이미지 처리
- [x] 메인-서브 매핑 강제 (서브는 메인 1개 필수)
  - ~~메인 에이전트는 여러 개 존재 가능~~
  - ~~서브 에이전트는 “필수”로 특정 메인 에이전트 1개에만 등록(다중 메인 불가)~~
  - 배치 실행 시 각 메인별로 자신에게 등록된 서브만 지시/병렬 호출
- [x] 채팅 mode 필드 optional화 + 서버 AI 자동 라우팅 (`CHAT`/`TODO`/`TODO_NEGOTIATION`)
- [x] TODO 생성 루프에 AI command planner + 실행기 연결 (`plannedCommands`)
- [x] 에이전트 툴셋 확장 API 추가 (`task-effort`, `split-task`, `rank-priority`, `detect-overload` 등)
- [x] 신규 툴 로그 추가 (`👉 [TOOL:...]`) 및 TODO 루프 관측성 강화

## 해야 할 것

- [x] Spring Scheduler 스켈레톤 (day_start_time / day_end_time 기반 배치 트리거)
- [x] 시작/종료 시간 스케줄러 실행 뼈대 + 사용자 알림 발송
- [x] 시작 시점 자동 에이전트 실행 + 브리핑 알림
- [ ] 종료 시점 서브 -> 메인 리포트 자동 수집
- [x] 메인 에이전트 일일 요약(오늘 경과/내일 계획) 자동 생성 및 사용자 전달
- [ ] 양방향 조정 (선택 TODO 기반 NEGOTIATE 흐름)
  - propose API: 선택 Todo IDs + 사용자 사유 입력 -> 감량/재배치 안 생성
  - accept API: 선택안 적용(일정 재배치 + 상태 전이) 트랜잭션 처리
  - retry API: 추가 조건 반영 재제안
- [ ] 자연어 조정 오케스트레이션
  - [x] 조정 의도 자동 감지 후 `group/day/single` 타깃 추론
  - [x] cross-agent TODO 후보 선택기(서버 보정) 구현
  - [ ] 조정안 A/B/C 자동 생성 -> 사용자 확인 -> 커밋 플로우
- [ ] 조정 권한 정책 서버 가드
  - [x] MAIN: 전체 TODO 조정 가능, SUB: 본인 소유 TODO만 조정 가능
  - [x] apply 직전 소유권(agentId) 검증 및 위반 reject
- [ ] 조정 상태/이력 모델 추가
  - Todo 상태: TODO -> NEGOTIATING -> RESCHEDULED/DONE
  - 조정 이력 저장: selected_todo_ids, user_reason, proposal_json, selected_option, status
- [ ] HITL(캘린더 이벤트 절대 우선) 주입/제약 로직
- [ ] Main Agent 오케스트레이션 구현 (Sub-Agent 병렬 호출: CompletableFuture, Structured Output JSON 파싱)
- [ ] Plan Snapshot / Sliding Window 컨텍스트 모델 구현 (JSON 1개 유지 + 요약은 브릿지로만)
- [ ] Report 제출/End Batch 요약 API 및 저장 흐름
- [x] AI 툴 호출(명령어) 화이트리스트 기반 실행기 1차 구축 (TODO 루프 내)
- [ ] AI 툴 호출 strict schema + 재시도/실패 정책 고도화
- [ ] 메인 에이전트 Draft 추천 API
  - [ ] `POST /api/agents/draft-recommendations`
  - [ ] `POST /api/agents/drafts/confirm-create`
  - [ ] draft 상태 모델(`DRAFT/CONFIRMED/CANCELLED`)
- [ ] 메인 에이전트 -> 서브 에이전트 TODO 등록 권한
  - [ ] 권한 모델 확장: MAIN이 자신의 소속 SUB agentId로 TODO 생성 허용
  - [ ] 생성 API에 targetAgentId 도입 및 소속 검증(비소속 SUB 차단)
  - [ ] 감사 로그 추가(요청자 agentId, 대상 agentId, 생성 todo id)
- [ ] TODO 정기 반복(Recurring TODO) 백엔드 지원
  - [ ] 반복 TODO 스키마 설계(반복 규칙, 기간, 예외일)
  - [ ] 반복 생성/조회/수정/중지 API 설계 및 구현
  - [ ] 캘린더/에이전트 툴 조회 시 반복 TODO 인스턴스 확장 규칙 통합

## 조정 기능 구현 순서 (권장)

1) Front: Todo 다중 선택 + 조정 요청 모달 + 제안 카드/적용 UI  
2) Back: `/api/todo/negotiations/propose|accept|retry` 3개 API  
3) AI: Structured Output(JSON)로 옵션 A/B/C 생성  
4) 적용 검증: 시간 충돌/HITL 제약/부분 성공 처리


## 이슈

- [x] 캘린더 현재 월 이외 다른 월 날짜 누르면 현재 월로 강제 이동 -> 월 이동이 안되는듯?
- [x] 정기 일정 등록 시, 현재 월 말고는 등록이 안됨 -> 이것도 월 이동 안되서 그런듯
- [x] 일정 등록시 하루종일 필요 시작, 종료 시간 같아도 됨