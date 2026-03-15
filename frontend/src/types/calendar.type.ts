/** 캘린더 이벤트 한 건 (API 응답 data, 백엔드 camelCase) */
export interface CalendarEventInterface {
  id: number
  title: string
  startAt: string
  endAt: string
  memo: string | null
  createdAt: string
  updatedAt: string
}

/** 목록 응답: ResultResponse<CalendarEventInterface[]> */
export interface CalendarEventListResponseInterface {
  status: number
  message: string
  data: CalendarEventInterface[] | null
}

/** 단건 응답: ResultResponse<CalendarEventInterface> */
export interface CalendarEventSingleResponseInterface {
  status: number
  message: string
  data: CalendarEventInterface | null
}

/** 생성 요청 body (ISO datetime 문자열) */
export interface CalendarEventCreateBodyInterface {
  title: string
  startAt: string
  endAt: string
  memo?: string
}

/** 수정 요청 body (전부 optional) */
export interface CalendarEventUpdateBodyInterface {
  title?: string
  startAt?: string
  endAt?: string
  memo?: string
}
