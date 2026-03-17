import { API } from '@/lib/client'
import type {
  ScheduleCreateBodyInterface,
  ScheduleOccurrenceInterface,
  ScheduleOccurrenceListResponseInterface,
  ScheduleOccurrenceSingleResponseInterface,
  ScheduleUpdateBodyInterface,
} from '@/types/schedule.type'

// 특정 날짜 기준 스케줄 조회
export async function getSchedulesByDay(date: string): Promise<ScheduleOccurrenceInterface[]> {
  const res = await API.get<ScheduleOccurrenceListResponseInterface>(
    '/api/calendar/schedules/day',
    { params: { date } },
  )
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '스케줄(일 단위) 조회에 실패했습니다.')
  }
  return res.data
}

// 특정 월 기준 스케줄 조회
export async function getSchedulesByMonth(
  year: number,
  month: number,
): Promise<ScheduleOccurrenceInterface[]> {
  const res = await API.get<ScheduleOccurrenceListResponseInterface>(
    '/api/calendar/schedules/month',
    { params: { year, month } },
  )
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '스케줄(월 단위) 조회에 실패했습니다.')
  }
  return res.data
}

// 스케줄 생성 (정기일정/일정/할일 공통)
export async function createSchedule(
  body: ScheduleCreateBodyInterface,
): Promise<ScheduleOccurrenceInterface> {
  const res = await API.post<ScheduleOccurrenceSingleResponseInterface>(
    '/api/calendar/schedules',
    body,
  )
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '스케줄 생성에 실패했습니다.')
  }
  return res.data
}

// 스케줄 부분 수정
export async function updateSchedule(
  id: number,
  body: ScheduleUpdateBodyInterface,
): Promise<ScheduleOccurrenceInterface> {
  const res = await API.patch<ScheduleOccurrenceSingleResponseInterface>(
    `/api/calendar/schedules/${id}`,
    body,
  )
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '스케줄 수정에 실패했습니다.')
  }
  return res.data
}

// 완료/완료 취소 토글
export async function toggleScheduleDone(id: number): Promise<ScheduleOccurrenceInterface> {
  const res = await API.patch<ScheduleOccurrenceSingleResponseInterface>(
    `/api/calendar/schedules/${id}/toggle-done`,
    {},
  )
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '스케줄 완료 상태 변경에 실패했습니다.')
  }
  return res.data
}

// 스케줄 삭제
export async function deleteSchedule(id: number): Promise<void> {
  const res = await API.delete<{ status: number; message: string; data: null }>(
    `/api/calendar/schedules/${id}`,
  )
  if (res.status !== 200) {
    throw new Error(res.message ?? '스케줄 삭제에 실패했습니다.')
  }
}
