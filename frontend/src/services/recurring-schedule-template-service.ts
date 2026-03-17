import { API } from '@/lib/client'
import type {
  RecurringScheduleTemplateInterface,
  RecurringScheduleTemplateListResponseInterface,
} from '@/types/recurring-schedule-template.type'

const BASE = '/api/calendar/recurring-templates'

export async function getRecurringScheduleTemplateList(): Promise<
  RecurringScheduleTemplateInterface[]
> {
  const res = await API.get<RecurringScheduleTemplateListResponseInterface>(BASE)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정 템플릿 목록을 불러오지 못했습니다.')
  }

  return res.data
}
