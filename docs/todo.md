# Front

## 현재 한 것

- [v] ~~프로젝트 셋업 (React, Vite, TanStack Router, Tailwind, shadcn/ui)~~
- [v] ~~홈 페이지 + 백엔드 헬스 체크 버튼~~
- [v] ~~health-service, types/health.type.ts~~
- [v] ~~frontend_rules.md 타입 규칙 추가 (3.2, types 도메인별)~~
- [v] ~~로그인 (JWT 발급, 로그인 페이지, 보호 라우트)~~
- [v] ~~캘린더 이벤트 API 연동 (목록/추가 화면)~~
- [v] ~~사용자 일과 시간 설정 화면 (day_start_time, day_end_time)~~
- [v] 캘린더 오른쪽 컬럼 UI 리팩토링 (정기일정/일정/할 일 개별 카드 + 비어 있을 때 최소 문구만 표시)
- [v] 정기일정/일정/할 일 데이터 로딩 상태 및 빈 목록 처리 통일 (pending + length 0일 때 섹션 숨김)
- [v] 정기일정/일정/할 일을 하나의 탭형 다이얼로그에서 추가할 수 있는 공통 폼 구현 (정기일정/일정/Todo 생성 연동)
- [v] 401 전역 처리 마무리 (refresh 엔드포인트 permitAll 반영 이후, 프론트 인터셉터·로그인 흐름 E2E 검증)

## 해야 할 것

- [ ] 캘린더 우측 Todo 카드 UX 보강
  - AI가 제안한 Todo를 "오늘 일정 옆에서" 빠르게 확인·완료 처리
  - 각 Todo에서 관련 채팅 화면으로 이동할 수 있는 엔트리 제공 (예: "채팅에서 협상하기" 버튼)
- [ ] 리포트/피드백 화면 (End Batch 요약)
- [ ] 메인 에이전트 채팅 UI
  - AI 대시보드 페이지: 메인 에이전트와 1:1 대화
  - "오늘 할 일 제안" 메시지와 실제 Todo 목록을 함께 보여주는 레이아웃
  - 채팅 메시지 단에서 "오늘 이거 좀 많은데 줄여주세요" 같은 협상 발화가 일어나도록 UX 설계
- [ ] 서브 에이전트 관리 UI (Agent_Role CRUD: 에이전트 이름/용도/프롬프트/is_active 설정 화면)
- [ ] 서브 에이전트 채팅 UI
  - 에이전트별 채팅 화면, 각 Agent_Role과 개별 대화
  - 과목/도메인별로 세분화된 할 일 생성·수정·협상이 채팅을 통해 이뤄지도록 설계

> 결정: "협상"은 별도의 Todo 목록/상세 페이지가 아니라 **메인/서브 에이전트 채팅 화면에서 대화로만 진행**한다.  
> Todo는 협상 결과가 반영된 **최종 일정 스냅샷**을 저장·표시하는 역할에 집중한다.

---

# Back

## 현재 한 것

- [v] ~~DB 설계 (JPA 엔티티: UserAccount, AgentRole, CalendarEvent, Todo, Report)~~
- [v] ~~Repository 레이어~~
- [v] ~~MySQL env 설정 (application.properties + .env, direnv)~~
- [v] ~~ResultResponse + 전역 예외 처리 + GET /api/health~~
- [v] ~~CORS 설정~~
- [v] ~~로그인/회원가입 API + JWT 발급, 인증 필터~~
- [v] ~~캘린더 이벤트 CRUD API (Controller, Service, DTO)~~
- [v] ~~UserAccount에 day_start_time, day_end_time 필드 + 설정 API (GET/PATCH)~~
- [v] Todo CRUD API (목록/상세/상태 변경, Main Agent 생성 연동은 이후)

## 해야 할 것

- [ ] Report 저장 API (Sub-Agent 제출용)
- [ ] Spring Scheduler 스켈레톤 (day_start_time / day_end_time 기반 배치 트리거)
- [ ] Agent_Role 관리 API (GET/POST/PATCH /api/agents, role_prompt 및 is_active 관리)
- [ ] 메인 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/main, 더미 응답으로 우선 구현)
  - 요청/응답 스키마에 Todo ID 목록 및 메타데이터(예: related_todo_ids) 포함
  - "오늘 할 일 제안" 및 "분량/일정 재조정" 응답 구조를 JSON으로 정의
- [ ] 서브 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/agents/{agentId}, 더미 응답으로 우선 구현)
  - 에이전트별로 생성·조정되는 Todo가 있다면 관련 Todo ID를 메시지에 매핑
  - 실제 LLM 연동 전까지는 하드코딩된 더미 메시지 세트로 동작
