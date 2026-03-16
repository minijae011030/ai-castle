import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  getCalendarEventList,
  updateCalendarEvent,
} from '@/services/calendar-service'
import type {
  CalendarEventCreateBodyInterface,
  CalendarEventInterface,
  CalendarEventUpdateBodyInterface,
} from '@/types/calendar.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

// 캘린더 관련 쿼리 키
export const calendar_query_keys = {
  all: ['calendar'] as const,
  list: () => [...calendar_query_keys.all, 'list'] as const,
  detail: (id: number) => [...calendar_query_keys.all, 'detail', id] as const,
}

// 캘린더 이벤트 목록 조회 훅
export const useCalendarEventList = (
  options?: UseQueryOptions<CalendarEventInterface[], Error>,
) => {
  return useQuery({
    queryKey: calendar_query_keys.list(),
    queryFn: async () => {
      const res = await getCalendarEventList()
      return res
    },
    select: useCallback((data: CalendarEventInterface[]) => data, []),
    ...options,
  })
}

// 캘린더 이벤트 단건 조회 훅
export const useCalendarEvent = (
  id: number,
  options?: UseQueryOptions<CalendarEventInterface, Error>,
) => {
  return useQuery({
    queryKey: calendar_query_keys.detail(id),
    queryFn: async () => {
      const result = await getCalendarEvent(id)
      return result
    },
    enabled: id > 0,
    select: useCallback((data: CalendarEventInterface) => data, []),
    ...options,
  })
}

// 캘린더 이벤트 생성 훅
export const useCreateCalendarEvent = (
  options?: UseMutationOptions<CalendarEventInterface, Error, CalendarEventCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (body: CalendarEventCreateBodyInterface) => {
      const result = await createCalendarEvent(body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 등록되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '등록에 실패했습니다.')
    },
    ...options,
  })
}

// 캘린더 이벤트 수정 훅
export const useUpdateCalendarEvent = (
  options?: UseMutationOptions<
    CalendarEventInterface,
    Error,
    { id: number; body: CalendarEventUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CalendarEventUpdateBodyInterface }) => {
      const result = await updateCalendarEvent(id, body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 수정되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '수정에 실패했습니다.')
    },
    ...options,
  })
}

// 캘린더 이벤트 삭제 훅
export const useDeleteCalendarEvent = (options?: UseMutationOptions<void, Error, number>) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await deleteCalendarEvent(id)
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 삭제되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '삭제에 실패했습니다.')
    },
    ...options,
  })
}
