import { API } from '@/lib/client'
import type {
  RecurringScheduleCreateBodyInterface,
  RecurringScheduleDataInterface,
  RecurringScheduleListResponseInterface,
  RecurringScheduleUpdateBodyInterface,
} from '@/types/recurring-schedule.type'

const BASE = '/api/calendar/recurring-schedules'

export async function getRecurringScheduleList(): Promise<RecurringScheduleDataInterface[]> {
  const res = await API.get<RecurringScheduleListResponseInterface>(BASE)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function createRecurringSchedule(
  body: RecurringScheduleCreateBodyInterface,
): Promise<RecurringScheduleDataInterface> {
  const res = await API.post<
    {
      status: number
      message: string
      data: RecurringScheduleDataInterface | null
    },
    RecurringScheduleCreateBodyInterface
  >(BASE, body)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정을 등록하지 못했습니다.')
  }

  return res.data
}

export async function updateRecurringSchedule(
  id: number,
  body: RecurringScheduleUpdateBodyInterface,
): Promise<RecurringScheduleDataInterface> {
  const res = await API.patch<
    {
      status: number
      message: string
      data: RecurringScheduleDataInterface | null
    },
    RecurringScheduleUpdateBodyInterface
  >(`${BASE}/${id}`, body)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '정기 일정을 수정하지 못했습니다.')
  }

  return res.data
}

export async function deleteRecurringSchedule(id: number): Promise<void> {
  const res = await API.delete<{
    status: number
    message: string
    data: null
  }>(`${BASE}/${id}`)

  if (res.status !== 200) {
    throw new Error(res.message ?? '정기 일정을 삭제하지 못했습니다.')
  }
}
