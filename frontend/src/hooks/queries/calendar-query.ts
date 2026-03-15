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
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const calendar_query_keys = {
  all: ['calendar'] as const,
  list: () => [...calendar_query_keys.all, 'list'] as const,
  detail: (id: number) => [...calendar_query_keys.all, 'detail', id] as const,
}

export const calendar_event_list_query_options = queryOptions({
  queryKey: calendar_query_keys.list(),
  queryFn: getCalendarEventList,
})

export const useCalendarEventList = (
  options?: Omit<UseQueryOptions<CalendarEventInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...calendar_event_list_query_options,
    ...options,
  })
}

export const useCalendarEvent = (
  id: number,
  options?: Omit<UseQueryOptions<CalendarEventInterface, Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    queryKey: calendar_query_keys.detail(id),
    queryFn: () => getCalendarEvent(id),
    enabled: id > 0,
    ...options,
  })
}

export const useCreateCalendarEvent = (
  options?: UseMutationOptions<CalendarEventInterface, Error, CalendarEventCreateBodyInterface>,
) => {
  const query_client = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: createCalendarEvent,
    onSuccess: (_data, _variables, _context, mutation) => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 등록되었습니다.')
      options?.onSuccess?.(_data, _variables, _context, mutation)
    },
    onError: (error) => {
      toast.error(error.message ?? '등록에 실패했습니다.')
      options?.onError?.(error)
    },
  })
}

export const useUpdateCalendarEvent = (
  options?: UseMutationOptions<
    CalendarEventInterface,
    Error,
    { id: number; body: CalendarEventUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: ({ id, body }) => updateCalendarEvent(id, body),
    onSuccess: (_data, variables, _context, mutation) => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 수정되었습니다.')
      options?.onSuccess?.(_data, variables, _context, mutation)
    },
    onError: (error) => {
      toast.error(error.message ?? '수정에 실패했습니다.')
      options?.onError?.(error)
    },
  })
}

export const useDeleteCalendarEvent = (options?: UseMutationOptions<void, Error, number>) => {
  const query_client = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: deleteCalendarEvent,
    onSuccess: (_data, _variables, _context, mutation) => {
      query_client.invalidateQueries({ queryKey: calendar_query_keys.all })
      toast.success('이벤트가 삭제되었습니다.')
      options?.onSuccess?.(_data, _variables, _context, mutation)
    },
    onError: (error) => {
      toast.error(error.message ?? '삭제에 실패했습니다.')
      options?.onError?.(error)
    },
  })
}
