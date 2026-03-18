import {
  createSchedule,
  createScheduleRange,
  deleteSchedule,
  getSchedulesByDay,
  getSchedulesByMonth,
  runTodoAgent,
  toggleRecurringScheduleDone,
  toggleScheduleDone,
  updateSchedule,
} from '@/services/schedule-service'
import type {
  ScheduleCreateBodyInterface,
  ScheduleOccurrenceInterface,
  ScheduleRangeCreateBodyInterface,
  ScheduleUpdateBodyInterface,
} from '@/types/schedule.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { ChatMessageInterface } from '@/types/chat.type'

// 캘린더/스케줄 관련 쿼리 키
export const schedule_query_keys = {
  all: ['schedule'] as const,
  day: (date: string) => [...schedule_query_keys.all, 'day', date] as const,
  month: (year: number, month: number) =>
    [...schedule_query_keys.all, 'month', `${year}-${month}`] as const,
}

// 특정 날짜 기준 스케줄 조회 훅
export const useSchedulesByDay = (
  date: string,
  options?: UseQueryOptions<ScheduleOccurrenceInterface[], Error>,
) => {
  return useQuery({
    queryKey: schedule_query_keys.day(date),
    queryFn: async () => {
      const res = await getSchedulesByDay(date)
      return res
    },
    enabled: Boolean(date),
    select: useCallback((data: ScheduleOccurrenceInterface[]) => data, []),
    ...options,
  })
}

// 특정 월 기준 스케줄 조회 훅
export const useSchedulesByMonth = (
  year: number,
  month: number,
  options?: UseQueryOptions<ScheduleOccurrenceInterface[], Error>,
) => {
  return useQuery({
    queryKey: schedule_query_keys.month(year, month),
    queryFn: async () => {
      const res = await getSchedulesByMonth(year, month)
      return res
    },
    enabled: Boolean(year) && Boolean(month),
    select: useCallback((data: ScheduleOccurrenceInterface[]) => data, []),
    ...options,
  })
}

// 스케줄 생성 훅
export const useCreateSchedule = (
  options?: UseMutationOptions<ScheduleOccurrenceInterface, Error, ScheduleCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: (body: ScheduleCreateBodyInterface) => createSchedule(body),
    onSuccess: (data, variables, context, mutation) => {
      // 날짜/월 단위 쿼리는 상황에 따라 invalidate
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('스케줄이 생성되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '스케줄 생성에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 스케줄 기간 생성 훅 (일정/할일) - 한 번의 요청으로 여러 날짜 생성
export const useCreateScheduleRange = (
  options?: UseMutationOptions<
    ScheduleOccurrenceInterface[],
    Error,
    ScheduleRangeCreateBodyInterface
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: (body: ScheduleRangeCreateBodyInterface) => createScheduleRange(body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('스케줄이 생성되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '스케줄 생성에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 스케줄 수정 훅
export const useUpdateSchedule = (
  options?: UseMutationOptions<
    ScheduleOccurrenceInterface,
    Error,
    { id: number; body: ScheduleUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }) => updateSchedule(id, body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('스케줄이 수정되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '스케줄 수정에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 스케줄 완료 토글 훅
export const useToggleScheduleDone = (
  options?: UseMutationOptions<ScheduleOccurrenceInterface, Error, { id: number }>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: ({ id }) => toggleScheduleDone(id),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('스케줄 완료 상태가 변경되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '스케줄 완료 상태 변경에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 정기 일정 템플릿 기반 완료 토글 훅
export const useToggleRecurringScheduleDone = (
  options?: UseMutationOptions<
    ScheduleOccurrenceInterface,
    Error,
    { templateId: number; date: string }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, date }) => toggleRecurringScheduleDone(templateId, date),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('정기 일정 완료 상태가 변경되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '정기 일정 완료 상태 변경에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 스케줄 삭제 훅
export const useDeleteSchedule = (options?: UseMutationOptions<void, Error, { id: number }>) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: ({ id }) => deleteSchedule(id),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: schedule_query_keys.all })
      toast.success('스케줄이 삭제되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '스케줄 삭제에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

// 할 일(TODO) 에이전트 실행 훅
export const useRunTodoAgent = (
  options?: UseMutationOptions<ChatMessageInterface, Error, { id: number }>,
) => {
  return useMutation({
    mutationFn: ({ id }) => runTodoAgent(id),
    onSuccess: (data, variables, context, mutation) => {
      toast.success('에이전트가 실행되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '에이전트 실행에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}
