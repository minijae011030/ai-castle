# 🏰 AI Castle (AI 캐슬) : 주도형(Proactive) VVIP 학습 코디네이팅 시스템

> **"어머니, 저를 전적으로 믿으셔야 합니다. 예서의 바이오리듬과 캘린더 일정에 맞춘 완벽한 코디네이팅을 시작하겠습니다."**

## 1. Project Philosophy & Overview
AI Castle은 단순한 챗봇이 아닙니다. 사용자의 라이프스타일(루틴 시간)과 절대적인 캘린더 일정을 기반으로, 시스템이 먼저 일정을 조율하고 알림을 주는 **주도형(Proactive) 계층형 멀티 에이전트(Hierarchical Multi-Agent)** 서비스입니다.    
드라마 '스카이캐슬'의 김주영 선생님(총괄)과 과목별 과외 선생님(실무) 시스템을 소프트웨어 아키텍처로 완벽하게 구현하는 것이 목표입니다.

## 2. Core Architecture & Workflow (Cursor 필독)

### 2.1. 계층형 에이전트 조율 시스템 (Supervisor Orchestration)
* **Main Agent (김주영 쓰앵님):** 거시적 스케줄링, 멘탈 케어, Sub Agent 업무 할당. (페르소나: 차갑고 분석적이며 단호함)
* **Sub Agents (과목별 쌤 - 코테, SQLD 등):** Main Agent의 하향 지시를 받아 구체적인 `Todo`를 생성하고, 학습 결과에 대한 미시적 피드백 제공. DB(`Agent_Role` 테이블)에 프롬프트를 동적으로 저장하여 확장성 확보.

### 2.2. 사용자 맞춤형 동적 스케줄링 (Dynamic Biorhythm Scheduling)
모든 사용자가 9시에 기상하지 않음. 사용자는 `day_start_time`(예: 15:00)과 `day_end_time`(예: 03:00)을 가짐. Backend 스케줄러는 주기적 폴링(Polling)을 통해 사용자의 시간에 맞춰 배치를 실행함.
> **[🎬 상황극으로 보는 기획 의도: 왜 시간 변수가 필요한가?]**
> * 👤 **사용자(예서):** "쓰앵님, 저 올빼미형이라 오후 3시에 일어나요. 아침 9시 알람은 너무 고통스러워요."
> * 🤖 **시스템(주영쌤):** "어머니, 예서의 바이오리듬은 오후 3시에 최고조에 달합니다. 오늘부터 모든 과목 선생님들의 스케줄을 예서의 기상 시간(15:00)에 맞춰 전면 재조정하겠습니다." (오후 3시에 Start Batch 작동)

### 2.3. Human-in-the-Loop (HITL) 캘린더 시스템
AI의 환각(Hallucination) 방지. 사용자가 직접 등록한 하드 데드라인을 Main Agent 프롬프트에 **RAG(Context Injection)** 방식으로 주입.
> **[🎬 상황극으로 보는 기획 의도: 왜 캘린더 DB를 억지로 주입하는가?]**
> * 📅 **캘린더 DB:** `[10:00 AM 정처기 실기 원서 접수]`
> * 🤖 **시스템(주영쌤):** "예서 학생, 오늘 10시 정처기 접수가 최우선입니다. 이에 따라 오늘 코테 쌤의 오전 알고리즘 진도는 전면 중지시켰습니다. 접수가 끝나는 대로 오후부터 집중하겠습니다."

### 2.4. 양방향 조율 및 재스케줄링 (Two-way Negotiation)
AI가 일방적으로 할 일을 던지는 블랙박스가 아님. 사용자가 조율을 요청(Feedback)하면, Main Agent가 이를 수용하여 분량 축소를 지시하고 DB를 업데이트(`Dynamic Rescheduling`)함.
> **[🎬 상황극으로 보는 기획 의도: 왜 Todo에 `NEGOTIATING` 상태가 필요한가?]**
> * 👤 **사용자(예서):** (할 일 목록을 보며) "매니저님, 오늘 학교 행사 때문에 늦게 끝나요. 코테랑 SQLD 양 좀 반으로 줄여주세요 ㅠㅠ"
> * 🤖 **시스템(주영쌤):** "알겠습니다. 컨디션 조절을 위해 코테 과제를 1개로 축소하고, 남은 분량은 주말 스케줄로 이관하겠습니다." (DB의 Todo 내역 즉시 수정)

### 2.5. 컨텍스트 윈도우 한계 극복 (Memory Management)
* **Sliding Window:** 대화가 멍청해지는 것을 막기 위해 DB 조회 시 '최근 N일 치'의 리포트만 추출하여 AI에게 전달.
* **System Prompt Injection:** API 호출 시 최상단 메시지에 항상 "너는 입시 코디네이터 김주영이다"라는 룰을 강제 주입하여 자아 유지.
---

## 3. Database ERD & Entities (JPA 뼈대 설계용)

Cursor는 Backend 코드를 작성할 때 다음 엔티티 관계를 반드시 반영해야 함.

1. **`Users` (사용자)**
   * `id`, `name`, `day_start_time`, `day_end_time` (루틴 시간)
2. **`Agent_Roles` (에이전트 명부)**
   * `id`, `name` (예: 코테 매니저), `role_prompt` (동적 프롬프트 내용), `is_active`
3. **`Calendar_Events` (사용자 절대 일정)**
   * `id`, `user_id`, `event_time`, `description` (예: 원서 접수 광클)
4. **`Todos` (할 일 및 조율 상태)**
   * `id`, `user_id`, `agent_id` (어떤 쌤이 냈는가)
   * `content`, `target_date`
   * `creator_type`: [USER, MAIN_AGENT, SUB_AGENT]
   * `status`: [PENDING(대기), ACCEPTED(수락), NEGOTIATING(조율중), DONE(완료)]
5. **`Daily_Reports` (일일 보고서)**
   * `id`, `user_id`, `agent_id`, `report_content` (과목별 피드백 요약), `created_at`

---

## 4. Tech Stack & Development Guide
* **모노레포 구조:** `/frontend` (React+Vite) 와 `/backend` (Spring Boot)
* **Frontend:** PWA를 고려한 React 설계. VIP 코디네이팅 룸 느낌의 세련된 다크 모드 UI/UX. 컴포넌트화 필수.
* **Backend:** Spring Boot (Java). 
  * 외부 무거운 AI 프레임워크(LangChain 등) 지양. 
  * `CompletableFuture`를 활용하여 Sub Agent들의 API를 **비동기 병렬 처리(Parallel Processing)**하여 응답(Latency) 최적화 필수.
  * OpenAI API 호출 결과는 안정성을 위해 구조화된 포맷(JSON / Structured Output)으로 응답받아 파싱할 것.