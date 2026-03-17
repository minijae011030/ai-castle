export type ScheduleType = 'RECURRING_OCCURRENCE' | 'CALENDAR_EVENT' | 'TODO'

export interface ScheduleOccurrenceInterface {
  id: number
  title: string
  description: string | null
  done: boolean
  type: ScheduleType
  occurrenceDate: string
  startAt: string
  endAt: string
  recurringTemplateId: number | null
  calendarEventId: number | null
  todoId: number | null
}

export interface ScheduleOccurrenceListResponseInterface {
  status: number
  message: string
  data: ScheduleOccurrenceInterface[] | null
}

export interface ScheduleOccurrenceSingleResponseInterface {
  status: number
  message: string
  data: ScheduleOccurrenceInterface | null
}

export interface ScheduleCreateBodyInterface {
  type: ScheduleType
  title: string
  description?: string
  occurrenceDate: string
  startAt: string
  endAt: string
  recurringTemplateId?: number
  calendarEventId?: number
  todoId?: number
  agentId?: number
}

export interface ScheduleUpdateBodyInterface {
  title?: string
  description?: string
  done?: boolean
  startAt?: string
  endAt?: string
}
