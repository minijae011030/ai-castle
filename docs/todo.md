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

## 해야 할 것

- [ ] 캘린더 화면에서 TODO 응답을 동일한 "편집 패널"로 이어서 수정/부분삭제/등록(채팅 패널과 UX 통합)
- [ ] S3 기반 이미지 업로드 + 이미지 채팅 UI
  - 채팅 입력에 이미지 첨부(1장/다장 선택 정책 필요)
  - 첨부된 이미지를 백엔드로 전달(업로드는 S3 위임: presigned URL 방식)
  - 이미지가 포함된 메시지를 OpenAI에 vision 입력으로 함께 전달
- [ ] 리포트/피드백 화면 (End Batch 요약)
- [ ] 메인 에이전트 채팅 UI
  - ~~AI 대시보드 페이지: 메인 에이전트와 1:1 대화~~
  - ~~"오늘 할 일 제안" 메시지와 실제 Todo 목록을 함께 보여주는 레이아웃~~
  - 채팅 메시지 단에서 "오늘 이거 좀 많은데 줄여주세요" 같은 협상 발화가 일어나도록 UX 설계
- [ ] 서브 에이전트 -> 메인 에이전트 연결 UI
  - 메인 에이전트 아래에 서브 에이전트가 있는 그림으로

> 결정: "협상"은 별도의 Todo 목록/상세 페이지가 아니라 **메인/서브 에이전트 채팅 화면에서 대화로만 진행**한다.  
> Todo는 협상 결과가 반영된 **최종 일정 스냅샷**을 저장·표시하는 역할에 집중한다.

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
- [x] ~~메인 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/main, 더미 응답으로 우선 구현)~~
  - 더미 응답 기반 UI/연동 스켈레톤 (TODO 오케스트레이션/협상 JSON 미구현)
- [x] ~~서브 에이전트 채팅 API 스켈레톤 (GET/POST /api/chat/agents/{agentId}, 더미 응답으로 우선 구현)~~
  - OpenAI 연동 + TODO 모드 Structured Output(`json_schema`)로 `todo[]` 파싱
  - `todo[]`에 `scheduledDate/startAt/endAt` 포함하도록 스키마 확정

## 해야 할 것

- [ ] Spring Scheduler 스켈레톤 (day_start_time / day_end_time 기반 배치 트리거)
- [ ] 양방향 협상 (TODO 과부하 인지 → NEGOTIATE 흐름 → 일정 재배치 + 상태 전이)
- [ ] HITL(캘린더 이벤트 절대 우선) 주입/제약 로직
- [ ] S3 업로드 백엔드 처리 + OpenAI vision 호출 연동
  - 프론트 업로드 정책: presigned URL 발급 또는 multipart 업로드 후 S3에 저장
  - 이미지 URL(또는 data URL)을 OpenAI 요청의 `image_url`로 전달
  - 이미지가 포함된 메시지에서도 `mode(CHAT|TODO)` 분기에 따라 동일한 응답 포맷을 유지
  - 사용되지 않은 temp 이미지 제거
- [ ] Main Agent 오케스트레이션 구현 (Sub-Agent 병렬 호출: CompletableFuture, Structured Output JSON 파싱)
- [ ] Plan Snapshot / Sliding Window 컨텍스트 모델 구현 (JSON 1개 유지 + 요약은 브릿지로만)
- [ ] Report 제출/End Batch 요약 API 및 저장 흐름
- [ ] 메인/서브 에이전트 매핑 규칙 확정
  - 메인 에이전트는 여러 개 존재 가능
  - 서브 에이전트는 “필수”로 특정 메인 에이전트 1개에만 등록(다중 메인 불가)
  - 배치 실행 시 각 메인별로 자신에게 등록된 서브만 지시/병렬 호출

