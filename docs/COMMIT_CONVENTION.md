# 📝 AI Castle Commit Convention

This document defines the git commit message convention for the AI Castle Monorepo.
**Cursor AI must strictly follow these rules when generating commit messages.**

## 1. Commit Message Format

커밋 메시지는 반드시 아래의 구조를 준수하며 **영어로 작성**해야 합니다.
제목(Subject)은 간결하게 작성하고, 한 줄을 띄운 뒤 본문(Body)에 자세한 설명을 적습니다.

```text
<type>(<scope>): <subject>

<body>
```

## 2. Scope (변경 범위)

모노레포 특성상 변경이 발생한 프로젝트의 위치를 괄호 () 안에 명시합니다.  
두 개 이상의 영역에 걸쳐 변경 사항이 발생한 경우, 파이프 | 기호를 사용하여 구분합니다.

| Scope | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| front | 프론트엔드 (React, PWA, UI/UX) 관련 변경 사항                    |
| back  | 백엔드 (Spring Boot, DB, AI Logic) 관련 변경 사항                |
| root  | 프로젝트 최상위 설정 (README, .cursorrules, 커밋 컨벤션 등) 변경 |

## 3. Type (작업 종류)

커밋의 목적에 맞는 올바른 타입을 선택해야 합니다.

| Type     | Description                                                           |
| -------- | --------------------------------------------------------------------- |
| feat     | 새로운 기능 추가 (New feature)                                        |
| fix      | 버그 수정 (Bug fix)                                                   |
| hotfix   | 치명적인 버그 긴급 수정 (Urgent bug fix)                              |
| design   | UI 디자인, CSS, 스타일링 변경 사항                                    |
| chore    | 빌드 업무 수정, 패키지 매니저 설정, 사소한 코드 수정 (기능 변경 없음) |
| docs     | 문서 추가 및 수정 (README.md 등)                                      |
| refactor | 코드 리팩토링 (기능적인 변화 없이 코드 구조 개선)                     |
| test     | 테스트 코드 추가, 수정 및 삭제                                        |

## 4. Examples (작성 예시)

### 4.1 단일 스코프 (백엔드 기능 추가)

```plaintext
feat(back): add dynamic scheduling batch process for proactive agent

- Implemented periodic polling in Spring Scheduler.
- Added logic to fetch user's day_start_time and day_end_time.
- Trigger Main Agent API based on biorhythm settings.
```

### 4.2 단일 스코프 (프론트엔드 디자인 수정)

```plaintext
design(front): update dashboard UI to VIP dark mode

- Applied dark theme colors to the main dashboard.
- Adjusted spacing and typography for better readability.
```

### 4.3 다중 스코프 (프론트/백엔드 API 연동)

```plaintext
feat(front|back): integrate schedule negotiation API

- (back) Added POST endpoint to handle user negotiation request.
- (back) Implemented DB status update logic (NEGOTIATING -> ACCEPTED).
- (front) Added "Negotiate" button and modal on Todo list UI.
- (front) Connected fetch API and handled loading state.
```

### 4.4 루트 스코프 (문서 업데이트)

```plaintext
docs(root): update project core architecture in README

- Added HITL (Human-in-the-Loop) calendar workflow.
- Elaborated Two-way negotiation scenario.
```
