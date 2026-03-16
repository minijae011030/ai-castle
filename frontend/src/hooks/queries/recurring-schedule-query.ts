import {
  create_recurring_schedule,
  get_recurring_schedule_list,
} from '@/services/recurring-schedule-service'
import type {
  RecurringScheduleCreateBodyInterface,
  RecurringScheduleDataInterface,
} from '@/types/recurring-schedule.type'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const recurring_schedule_query_keys = {
  all: ['recurring_schedule'] as const,
  list: () => [...recurring_schedule_query_keys.all, 'list'] as const,
}

export const recurring_schedule_list_query_options = queryOptions({
  queryKey: recurring_schedule_query_keys.list(),
  queryFn: get_recurring_schedule_list,
})

export const useRecurringScheduleList = (
  options?: Omit<UseQueryOptions<RecurringScheduleDataInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...recurring_schedule_list_query_options,
    ...options,
  })
}

export const useCreateRecurringSchedule = (
  options?: UseMutationOptions<
    RecurringScheduleDataInterface,
    Error,
    RecurringScheduleCreateBodyInterface
  >,
) => {
  const query_client = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: create_recurring_schedule,
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: recurring_schedule_query_keys.all })
      toast.success('정기 일정이 등록되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '정기 일정을 등록하지 못했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}
