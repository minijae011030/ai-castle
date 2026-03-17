# 할 일 / 일정 도메인 설계

## 1. 공통 엔티티 (BaseScheduleEntity)

모든 스케줄 엔티티는 아래 공통 속성을 가진다.

- `id`: UUID (PK)
- `title`: string
- `description`: string \| null
- `done`: boolean
- `startAt`: datetime (시작 시각)
- `endAt`: datetime (종료 시각)

이를 기반으로 **“날짜별 인스턴스 엔티티”** 인 `BaseScheduleEntity` 를 정의한다.  
정기일정 템플릿에는 `done` 이 존재하지 않고, **날짜별 인스턴스에만 `done` 이 존재**한다.

```ts
type BaseScheduleEntity = {
  id: string
  title: string
  description: string | null
  done: boolean
  startAt: string
  endAt: string
}
```

## 2. 템플릿 / 인스턴스 분리

정기일정의 `done` 문제를 해결하기 위해, **템플릿 엔티티**와 **날짜별 인스턴스 엔티티**를 분리한다.

- 템플릿: 반복 패턴/정의 (예: “월/수 9–10시 수업”)
- 인스턴스: 특정 날짜 D 에 실제로 존재하는 “오늘의 일정/할일” 한 건

### 2.1. 템플릿 엔티티

#### 2.1.1. 정기일정 템플릿 (RecurringScheduleTemplate)

정기일정 템플릿은 반복 규칙만 가진다. **`done` 필드는 없다.**

```ts
type RecurringScheduleTemplate = {
  id: string
  title: string
  description: string | null
  periodStartDate: string      // YYYY-MM-DD
  periodEndDate: string        // YYYY-MM-DD
  repeatWeekdays: string[]     // ['MON', 'WED', ...]
  startTime: string            // HH:mm
  endTime: string              // HH:mm
}
```

#### 2.1.2. 단일 일정 템플릿 (CalendarEventTemplate)

단일 일정은 별도 템플릿 없이, 그대로 인스턴스로 취급해도 되지만,  
백엔드 모델 상 구분이 필요하면 다음과 같이 둘 수 있다.

```ts
type CalendarEventTemplate = {
  id: string
  title: string
  description: string | null
  startAt: string  // datetime
  endAt: string    // datetime
}
```

#### 2.1.3. 할 일 템플릿 (TodoTemplate)

할 일도 “템플릿”이 필요하다면 다음과 같이 둘 수 있지만,  
일반적인 케이스에서는 인스턴스(`TodoEntity`)만 두고 시작해도 된다.

```ts
type TodoTemplate = {
  id: string
  title: string
  description: string | null
  agentRoleId: number
}
```

### 2.2. 날짜별 인스턴스 엔티티 (ScheduleEntity)

캘린더/오늘 할 일 UI 에서 실제로 다루는 것은 **날짜별 인스턴스**이다.  
정기일정 템플릿에서 파생된 인스턴스에도 `done` 이 붙는다.

#### 2.2.1. 공통 인스턴스 타입

```ts
type ScheduleEntityType = 'RECURRING_OCCURRENCE' | 'CALENDAR_EVENT' | 'TODO'

type BaseScheduleEntity = {
  id: string               // occurrence id (템플릿 id가 아님)
  title: string
  description: string | null
  done: boolean
  startAt: string          // datetime
  endAt: string            // datetime
  type: ScheduleEntityType
}
```

#### 2.2.2. 정기일정 인스턴스 (RecurringOccurrenceEntity)

```ts
type RecurringOccurrenceEntity = BaseScheduleEntity & {
  type: 'RECURRING_OCCURRENCE'
  templateId: string       // RecurringScheduleTemplate.id
  occurrenceDate: string   // YYYY-MM-DD
}
```

#### 2.2.3. 일정 인스턴스 (CalendarEventEntity)

```ts
type CalendarEventEntity = BaseScheduleEntity & {
  type: 'CALENDAR_EVENT'
}
```

#### 2.2.4. 할 일 인스턴스 (TodoEntity)

```ts
type TodoEntity = BaseScheduleEntity & {
  type: 'TODO'
  agentRoleId: number      // 관련 에이전트 롤 ID
}
```

할 일 생성 주체:

- 사용자가 직접 입력
- 에이전트(AI)가 자동 생성

## 3. 캘린더 뷰 요구사항

- **표시 대상**: 정기일정 / 일정 / 할 일을 모두 하나의 리스트로 보여준다.
- **레이아웃**
  - 왼쪽: 월별 캘린더 격자 (날짜 셀)
  - 오른쪽: 선택된 날짜의 스케줄 리스트

### 3.1. 오른쪽 리스트 규칙

- 정기일정 / 일정 / 할 일을 **타입별로 박스를 나누지 않는다.**
- 하나의 공통 “할 일 카드” UI 컴포넌트로 렌더링하고, 한 리스트에 섞어서 보여준다.
- 특정 날짜 \(D\)를 선택했을 때:
  - D 날짜에 해당하는 정기일정 인스턴스들
  - D 날짜에 시간이 걸쳐 있는 모든 일정들
  - D 날짜로 스케줄된 할 일들  
  → 전부 하나의 배열로 모아 시간/우선순위 기준으로 정렬하여 아래로 스크롤하며 본다.

### 3.2. 날짜 기준 필터링 규칙

- 정기일정:
  - `periodStartDate ≤ D ≤ periodEndDate`
  - `repeatWeekdays` 에 D의 요일 코드가 포함 (예: 'MON')
- 일정:
  - `[startAt, endAt]` 구간이 날짜 D와 겹치는 모든 이벤트
- 할 일:
  - `startAt` 또는 별도 `scheduledDate` 가 날짜 D 인 모든 Todo

```ts
type ScheduleEntity =
  | RecurringOccurrenceEntity
  | CalendarEventEntity
  | TodoEntity

// 특정 날짜 D 기준으로 ScheduleEntity[] 를 만들어 오른쪽 리스트에 렌더링한다.
```

## 4. API 설계 (초안)

### 4.1. 공통 타입 기반 단일 조회 API

#### 4.1.1. 월별 스케줄 조회

- **Endpoint**: `GET /api/calendar/schedules/month`
- **Query**
  - `year`: number (예: 2026)
  - `month`: number (1–12)
- **Response**
  - `ResultResponse<ScheduleEntity[]>`

```jsonc
GET /api/calendar/schedules/month?year=2026&month=3

// data 예시 (여러 날이 섞여 있음)
{
  "status": 200,
  "message": "OK",
  "data": [
    {
      "id": "uuid-1",
      "title": "알고리즘 스터디",
      "description": "매주 월/수",
      "done": false,
      "startAt": "2026-03-02T20:00:00",
      "endAt": "2026-03-02T22:00:00",
      "type": "RECURRING_SCHEDULE",
      "periodStartDate": "2026-03-01",
      "periodEndDate": "2026-06-30",
      "repeatWeekdays": ["MON", "WED"],
      "agentRoleId": null
    },
    {
      "id": "uuid-2",
      "title": "병원 예약",
      "description": "치과",
      "done": false,
      "startAt": "2026-03-10T15:00:00",
      "endAt": "2026-03-10T16:00:00",
      "type": "CALENDAR_EVENT",
      "periodStartDate": null,
      "periodEndDate": null,
      "repeatWeekdays": null,
      "agentRoleId": null
    },
    {
      "id": "uuid-3",
      "title": "SQL 문제 3개 풀기",
      "description": null,
      "done": false,
      "startAt": "2026-03-10T00:00:00",
      "endAt": "2026-03-10T23:59:59",
      "type": "TODO",
      "periodStartDate": null,
      "periodEndDate": null,
      "repeatWeekdays": null,
      "agentRoleId": 1
    }
  ]
}
```

> 프론트에서는 month API 결과를 캐싱하고, 날짜 선택 시 4.1.2의 일별 조회를 사용해도 되고,  
> month 결과만으로 필터링해서 써도 된다. 구현 난이도/성능을 보고 선택.

#### 4.1.2. 특정 날짜 스케줄 조회 (인스턴스 기준)

- **Endpoint**: `GET /api/calendar/schedules/day`
- **Query**
  - `date`: string (YYYY-MM-DD)
- **Response**
  - `ResultResponse<ScheduleEntity[]>`  
    (모두 **날짜별 인스턴스 기준**으로 내려온다. 정기일정 템플릿 → RecurringOccurrenceEntity 로 펼쳐진 상태)

```jsonc
GET /api/calendar/schedules/day?date=2026-03-10

{
  "status": 200,
  "message": "OK",
  "data": [
    // 위 month 예시에서 날짜 기준 필터링된 결과와 동일한 형태 (RecurringOccurrence 포함)
  ]
}
```

### 4.2. 완료 토글 API

- **Endpoint**: `PATCH /api/calendar/schedules/{id}/toggle-done`
- **Body**
  - 없음 (서버에서 `done: true/false` 토글)
- **동작 규칙**
  - `type`이 `TODO` 인 경우:
    - 내부 `TodoStatus` 를 예: `PENDING <-> DONE` 으로 변환
  - `type`이 `CALENDAR_EVENT` 인 경우:
    - 단일 일정의 완료 여부만 토글 (필요 없으면 항상 false 로 운영할 수도 있음)
  - `type`이 `RECURRING_OCCURRENCE` 인 경우:
    - 정기일정 템플릿과 별도의 **“해당 날짜 인스턴스”의 완료 상태**만 토글
    - 템플릿에는 `done` 이 없고, 인스턴스에만 `done` 이 있으므로  
      **날짜마다 독립적으로 완료 처리**가 가능하다.

```jsonc
PATCH /api/calendar/schedules/uuid-3/toggle-done

{
  "status": 200,
  "message": "OK",
  "data": {
    "id": "uuid-3",
    "done": true
    // 나머지 ScheduleEntity 필드들...
  }
}
```

### 4.3. 등록/수정/삭제 API (단일 엔드포인트)

#### 4.3.1. 생성 (Create)

- **Endpoint**: `POST /api/calendar/schedules`
- **Body (discriminated union)**  
  - `type` 필드로 분기한다.

```jsonc
// 정기일정 생성
POST /api/calendar/schedules
{
  "type": "RECURRING_SCHEDULE",
  "title": "알바",
  "description": "편의점",
  "periodStartDate": "2026-03-01",
  "periodEndDate": "2026-03-31",
  "repeatWeekdays": ["MON", "WED"],
  "startAt": "2026-03-01T09:00:00",
  "endAt": "2026-03-01T12:00:00"
}

// 일정 생성
POST /api/calendar/schedules
{
  "type": "CALENDAR_EVENT",
  "title": "병원 예약",
  "description": "치과",
  "startAt": "2026-03-10T15:00:00",
  "endAt": "2026-03-10T16:00:00"
}

// 할 일 생성
POST /api/calendar/schedules
{
  "type": "TODO",
  "title": "SQL 문제 3개 풀기",
  "description": null,
  "startAt": "2026-03-10T00:00:00",
  "endAt": "2026-03-10T23:59:59",
  "agentRoleId": 1
}
```

- **Response**
  - `ResultResponse<ScheduleEntity>`

#### 4.3.2. 수정 (Update)

- **Endpoint**: `PATCH /api/calendar/schedules/{id}`
- **Body**
  - 부분 업데이트 허용 (모든 필드 optional)

```jsonc
PATCH /api/calendar/schedules/uuid-3
{
  "title": "SQL 문제 5개 풀기",
  "done": false
}
```

- 타입별 제약:
  - `RECURRING_SCHEDULE`:
    - `periodStartDate`, `periodEndDate`, `repeatWeekdays` 수정 가능
  - `CALENDAR_EVENT`:
    - `startAt`, `endAt` 시간대 수정 가능
  - `TODO`:
    - `agentRoleId`, `title`, `description`, `startAt`, `endAt`, `done` 수정 가능

#### 4.3.3. 삭제 (Delete)

- **Endpoint**: `DELETE /api/calendar/schedules/{id}`
- **Response**
  - `ResultResponse<void>`

```jsonc
DELETE /api/calendar/schedules/uuid-3

{
  "status": 200,
  "message": "삭제되었습니다.",
  "data": null
}
```
