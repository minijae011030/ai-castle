# ⚙️ AI Castle Backend Development Rules

## 1. Naming & Coding Conventions

### 1.1. Case Styles

- Classes: PascalCase (e.g., UserService, TodoController)
- Methods & Variables: camelCase (e.g., getUserByRoutine, isProcessing)
- DB Tables & Columns: snake_case (e.g., user_account, day_start_time)
- Enum Constants: UPPER_SNAKE_CASE (e.g., DONE, NEGOTIATING)

### 1.2. Architecture Layers

- Controller: API 엔드포인트 정의 및 요청 유효성 검사.
- Service: 핵심 비즈니스 로직 및 AI 에이전트 조율.
- Repository: JPA를 이용한 데이터베이스 접근.
- Entity: DB 테이블과 매핑되는 도메인 모델. (비즈니스 로직 포함 가능)
- DTO (Data Transfer Object): 계층 간 데이터 이동을 위한 객체. (Java Record 사용 권장)

## 2. API Response Pattern

### 2.1. Unified Response Format

프론트엔드와 통신 시 일관성을 위해 모든 응답은 ResultResponse<T> 객체로 감쌉니다.

```java
public record ResultResponse<T>(
    int status,
    String message,
    T data
) {}
```

- 성공 시: status: 200
- 실패 시: 에러 코드와 적절한 메시지 반환.

## 3. AI Agent & Concurrency Rules (핵심)

### 3.1. Parallel Agent Execution

- Main Agent(김주영)가 여러 Sub Agent(과외쌤)에게 업무를 지시할 때, 응답 속도를 위해 반드시 **CompletableFuture**를 사용하여 병렬 처리합니다.

```java
// 예시 로직
CompletableFuture<Todo> mathTask = CompletableFuture.supplyAsync(() -> mathAgent.generateTodo());
CompletableFuture<Todo> engTask = CompletableFuture.supplyAsync(() -> engAgent.generateTodo());

// 모든 과외쌤의 응답이 올 때까지 기다린 후 합침
CompletableFuture.allOf(mathTask, engTask).join();
```

### 3.2. Structured AI Output

- OpenAI API 호출 시 **Structured Output(JSON 모드)**을 활성화합니다.
- AI의 응답(JSON)을 자바 객체(DTO)로 즉시 파싱하여 타입 안정성을 확보합니다.

## 4. Biorhythm & Scheduling Logic

### 4.1. User-Specific Dynamic Batch

- 고정된 시간이 아닌, 각 사용자의 day_start_time에 맞춰 배치가 작동해야 합니다.
- Spring Scheduler 혹은 Quartz를 사용하여 1분 단위로 폴링하며, 현재 시간이 사용자의 기상/취침 시간과 일치하는지 확인 후 로직을 트리거합니다.

## 5. Database & JPA Rules

### 5.1. Entity Design

- 모든 엔티티는 BaseTimeEntity를 상속받아 생성/수정 시간을 자동으로 기록합니다.
- FetchType.LAZY를 기본으로 사용하여 불필요한 데이터 조회를 방지합니다.

### 5.2. Data Consistency

- 일정 조율(Negotiation) 시 여러 테이블이 변경되므로, 반드시 @Transactional 어노테이션을 사용하여 데이터 무결성을 보장합니다.

## 6. Exception Handling

### 6.1. Global Exception Handler

- @RestControllerAdvice를 사용하여 전역 에러 핸들러를 구현합니다.
- 에러 발생 시 프론트엔드가 이해할 수 있는 ResultResponse 포맷으로 에러 정보를 반환합니다.

## 7. Folder Structure (Backend)

```text
src/main/java/com/aicastle/
├── controller/         # API 엔드포인트
├── service/            # 비즈니스 로직 (AI 조율 로직 포함)
├── repository/         # DB 접근 (JPA)
├── entity/             # DB 테이블 매핑
├── dto/                # 요청/응답 객체 (Records)
├── config/             # Security, AI Client, Swagger 설정
├── exception/          # 커스텀 예외 및 핸들러
└── scheduler/          # 사용자별 동적 배치 로직

```
