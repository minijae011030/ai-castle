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

export interface ScheduleOccurrenceRangeResponseInterface {
  status: number
  message: string
  data: ScheduleOccurrenceInterface[] | null
}

export interface ScheduleCreateBodyInterface {
  type: ScheduleType
  title: string
  description?: string
  occurrenceDate: string
  startAt: string
  endAt: string
  recurringTemplateId?: number
  agentId?: number
}

export interface ScheduleRangeCreateBodyInterface {
  type: Exclude<ScheduleType, 'RECURRING_OCCURRENCE'>
  title: string
  description?: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  agentId?: number
}

export interface ScheduleUpdateBodyInterface {
  title?: string
  description?: string
  done?: boolean
  startAt?: string
  endAt?: string
}
