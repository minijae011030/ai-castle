import { API } from '@/lib/client'
import type {
  CalendarEventCreateBodyInterface,
  CalendarEventInterface,
  CalendarEventListResponseInterface,
  CalendarEventSingleResponseInterface,
  CalendarEventUpdateBodyInterface,
} from '@/types/calendar.type'

const BASE = '/api/calendar/events'

/** 목록 조회 */
export async function getCalendarEventList(): Promise<CalendarEventInterface[]> {
  const res = await API.get<CalendarEventListResponseInterface>(BASE)
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '목록 조회에 실패했습니다.')
  }
  return res.data
}

/** 단건 조회 */
export async function getCalendarEvent(id: number): Promise<CalendarEventInterface> {
  const res = await API.get<CalendarEventSingleResponseInterface>(`${BASE}/${id}`)
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '이벤트 조회에 실패했습니다.')
  }
  return res.data
}

/** 생성 (백엔드는 HTTP 201이어도 body에는 status: 200 내려옴) */
export async function createCalendarEvent(
  body: CalendarEventCreateBodyInterface,
): Promise<CalendarEventInterface> {
  const res = await API.post<CalendarEventSingleResponseInterface>(BASE, body)
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '등록에 실패했습니다.')
  }
  return res.data
}

/** 수정 */
export async function updateCalendarEvent(
  id: number,
  body: CalendarEventUpdateBodyInterface,
): Promise<CalendarEventInterface> {
  const res = await API.patch<CalendarEventSingleResponseInterface>(`${BASE}/${id}`, body)
  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '수정에 실패했습니다.')
  }
  return res.data
}

/** 삭제 */
export async function deleteCalendarEvent(id: number): Promise<void> {
  const res = await API.delete<{ status: number; message: string; data: null }>(`${BASE}/${id}`)
  if (res.status !== 200) {
    throw new Error(res.message ?? '삭제에 실패했습니다.')
  }
}
