export interface RecurringScheduleTemplateInterface {
  id: number
  title: string
  description: string | null
  periodStartDate: string
  periodEndDate: string
  repeatWeekdays: string
  startTime: string
  endTime: string
}

export interface RecurringScheduleTemplateListResponseInterface {
  status: number
  message: string
  data: RecurringScheduleTemplateInterface[] | null
}

export interface RecurringScheduleTemplateSingleResponseInterface {
  status: number
  message: string
  data: RecurringScheduleTemplateInterface | null
}

export interface RecurringScheduleTemplateCreateBodyInterface {
  title: string
  description?: string
  periodStartDate: string
  periodEndDate: string
  repeatWeekdays: string
  startTime: string
  endTime: string
}
