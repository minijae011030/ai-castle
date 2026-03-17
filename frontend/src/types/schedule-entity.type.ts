// 공통 일정 엔티티의 베이스 타입
export type ScheduleEntityType = 'RECURRING_SCHEDULE' | 'CALENDAR_EVENT' | 'TODO'

export interface BaseScheduleEntityInterface {
  // 공통 식별자
  id: number
  // 공통 제목
  title: string
  // 설명/메모 통합 필드 (null 허용)
  description: string | null
  // 완료 여부 (할일 기준, 나머지는 항상 false 로 사용 가능)
  done: boolean
  // 엔티티 유형 (정기일정/일정/할일 구분용)
  type: ScheduleEntityType
}

// 정기일정: 기간 + 반복 요일/시간
export interface RecurringScheduleEntityInterface extends BaseScheduleEntityInterface {
  type: 'RECURRING_SCHEDULE'
  // 반복 적용 시작/종료 기간 (YYYY-MM-DD)
  periodStartDate: string
  periodEndDate: string
  // 반복 요일 목록 (예: ['MON', 'WED'])
  repeatWeekdays: string[]
  // 하루 중 시작/종료 시각 (HH:mm)
  startTime: string
  endTime: string
}

// 단건 일정: 특정 날짜(또는 구간)에 대한 이벤트
export interface CalendarEventEntityInterface extends BaseScheduleEntityInterface {
  type: 'CALENDAR_EVENT'
  // 일정이 속한 기준 날짜 (캘린더 셀 기준 날짜, YYYY-MM-DD)
  date: string
  // 시작/종료 시각 정보 (ISO 문자열 그대로 보존)
  startAt: string
  endAt: string
}

// 할일: 날짜 + 관련 에이전트 ID
export interface TodoEntityInterface extends BaseScheduleEntityInterface {
  type: 'TODO'
  // 예정 날짜 (YYYY-MM-DD)
  date: string
  // 관련 에이전트(또는 에이전트 롤) 식별자
  agentId: number
  // 백엔드 TODO 상태를 그대로 보존
  status: import('./todo.type').TodoStatus
  // 같은 날짜 내 정렬을 위한 인덱스
  orderIndex: number
}

// 캘린더/타임라인에서 한 번에 다루기 위한 유니언 타입
export type ScheduleEntityInterface =
  | RecurringScheduleEntityInterface
  | CalendarEventEntityInterface
  | TodoEntityInterface
