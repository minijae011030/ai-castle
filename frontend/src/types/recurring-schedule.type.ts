export interface RecurringScheduleDataInterface {
  id: number
  title: string
  periodStart: string
  periodEnd: string
  weekdays: string
  startTime: string
  endTime: string
  memo: string | null
}

export interface RecurringScheduleListResponseInterface {
  status: number
  message: string
  data: RecurringScheduleDataInterface[] | null
}

export interface RecurringScheduleCreateBodyInterface {
  title: string
  periodStart: string
  periodEnd: string
  weekdays: string
  startTime: string
  endTime: string
  memo?: string
}

export interface RecurringScheduleUpdateBodyInterface {
  title?: string
  periodStart?: string
  periodEnd?: string
  weekdays?: string
  startTime?: string
  endTime?: string
  memo?: string
}
