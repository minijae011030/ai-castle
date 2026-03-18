import { API } from '@/lib/client'
import type {
  RecurringScheduleTemplateCreateBodyInterface,
  RecurringScheduleTemplateInterface,
  RecurringScheduleTemplateListResponseInterface,
  RecurringScheduleTemplateSingleResponseInterface,
} from '@/types/recurring-schedule-template.type'

export async function getRecurringScheduleTemplateList(): Promise<
  RecurringScheduleTemplateInterface[]
> {
  const res = await API.get<RecurringScheduleTemplateListResponseInterface>(
    '/api/calendar/recurring-templates',
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정 템플릿 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function createRecurringScheduleTemplate(
  body: RecurringScheduleTemplateCreateBodyInterface,
): Promise<RecurringScheduleTemplateInterface> {
  const res = await API.post<RecurringScheduleTemplateSingleResponseInterface>(
    '/api/calendar/recurring-templates',
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정 템플릿 생성에 실패했습니다.')
  }

  return res.data
}
