import {
  createRecurringSchedule,
  deleteRecurringSchedule,
  getRecurringScheduleList,
  updateRecurringSchedule,
} from '@/services/recurring-schedule-service'
import type {
  RecurringScheduleCreateBodyInterface,
  RecurringScheduleDataInterface,
  RecurringScheduleUpdateBodyInterface,
} from '@/types/recurring-schedule.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export const recurring_schedule_query_keys = {
  all: ['recurring_schedule'] as const,
  list: () => [...recurring_schedule_query_keys.all, 'list'] as const,
}

// 정기 일정 목록 조회 훅
export const useRecurringScheduleList = (
  options?: UseQueryOptions<RecurringScheduleDataInterface[], Error>,
) => {
  return useQuery({
    queryKey: recurring_schedule_query_keys.list(),
    queryFn: async () => {
      const res = await getRecurringScheduleList()
      return res
    },
    select: useCallback((data: RecurringScheduleDataInterface[]) => data, []),
    ...options,
  })
}

// 정기 일정 생성 훅
export const useCreateRecurringSchedule = (
  options?: UseMutationOptions<
    RecurringScheduleDataInterface,
    Error,
    RecurringScheduleCreateBodyInterface
  >,
) => {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: createRecurringSchedule,
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: recurring_schedule_query_keys.all })
      toast.success('정기 일정이 등록되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '정기 일정을 등록하지 못했습니다.')
    },
    ...options,
  })
}

// 정기 일정 수정 훅
export const useUpdateRecurringSchedule = (
  options?: UseMutationOptions<
    RecurringScheduleDataInterface,
    Error,
    { id: number; body: RecurringScheduleUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => updateRecurringSchedule(id, body),
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: recurring_schedule_query_keys.all })
      toast.success('정기 일정이 수정되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '정기 일정을 수정하지 못했습니다.')
    },
    ...options,
  })
}

// 정기 일정 삭제 훅
export const useDeleteRecurringSchedule = (options?: UseMutationOptions<void, Error, number>) => {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: deleteRecurringSchedule,
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: recurring_schedule_query_keys.all })
      toast.success('정기 일정이 삭제되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '정기 일정을 삭제하지 못했습니다.')
    },
    ...options,
  })
}
