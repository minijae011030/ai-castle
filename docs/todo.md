# Front

## 현재한것

- [v] ~~프로젝트 셋업 (React, Vite, TanStack Router, Tailwind, shadcn/ui)~~
- [v] ~~홈 페이지 + 백엔드 헬스 체크 버튼~~
- [v] ~~health-service, types/health.type.ts~~
- [v] ~~frontend_rules.md 타입 규칙 추가 (3.2, types 도메인별)~~
- [v] ~~로그인 (JWT 발급, 로그인 페이지, 보호 라우트)~~
- [v] ~~캘린더 이벤트 API 연동 (목록/추가 화면)~~
- [v] ~~사용자 일과 시간 설정 화면 (day_start_time, day_end_time)~~

## 해야할것

- [ ] Todo 목록/상세 화면 (AI 생성 일정 확인·협상 버튼)
- [ ] 리포트/피드백 화면 (End Batch 요약)
- [ ] 401 전역 처리 (axios 인터셉터에서 토큰 만료 시 clearAuth + /login 리다이렉트)
- [ ] 메인 에이전트 채팅 UI (AI 대시보드 페이지: 메인 에이전트와 1:1 대화, Todo/리포트 요약 노출)
- [ ] 서브 에이전트 관리 UI (Agent_Role CRUD: 에이전트 이름/용도/프롬프트/is_active 설정 화면)
- [ ] 서브 에이전트 채팅 UI (에이전트별 채팅 화면, 각 Agent_Role과 개별 대화)

---

# Back

## 현재한것

- [v] ~~DB 설계 (JPA 엔티티: UserAccount, AgentRole, CalendarEvent, Todo, Report)~~
- [v] ~~Repository 레이어~~
- [v] ~~MySQL env 설정 (application.properties + .env, direnv)~~
- [v] ~~ResultResponse + 전역 예외 처리 + GET /api/health~~
- [v] ~~CORS 설정~~
- [v] ~~로그인/회원가입 API + JWT 발급, 인증 필터~~
- [v] ~~캘린더 이벤트 CRUD API (Controller, Service, DTO)~~
- [v] ~~UserAccount에 day_start_time, day_end_time 필드 + 설정 API (GET/PATCH)~~

## 해야할것

- [ ] Todo CRUD API (목록/상세/상태 변경, Main Agent 생성 연동은 이후)
- [ ] Report 저장 API (Sub-Agent 제출용)
- [ ] Spring Scheduler 스켈레톤 (day_start_time / day_end_time 기반 배치 트리거)
- [ ] Agent_Role 관리 API (GET/POST/PATCH /api/agents, role_prompt 및 is_active 관리)
- [ ] 메인 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/main, 더미 응답으로 우선 구현)
- [ ] 서브 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/agents/{agentId}, 더미 응답으로 우선 구현)
