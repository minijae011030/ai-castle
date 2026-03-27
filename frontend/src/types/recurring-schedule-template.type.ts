export interface RecurringScheduleTemplateInterface {
  id: number
  title: string
  category: string | null
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
  category?: string
  description?: string
  periodStartDate: string
  periodEndDate: string
  repeatWeekdays: string
  startTime: string
  endTime: string
}
