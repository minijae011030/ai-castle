import {
  createRecurringScheduleTemplate,
  getRecurringScheduleTemplateList,
} from '@/services/recurring-schedule-template-service'
import type {
  RecurringScheduleTemplateCreateBodyInterface,
  RecurringScheduleTemplateInterface,
} from '@/types/recurring-schedule-template.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export const recurring_schedule_template_query_keys = {
  all: ['recurring_schedule_template'] as const,
  list: () => [...recurring_schedule_template_query_keys.all, 'list'] as const,
}

export const useRecurringScheduleTemplateList = (
  options?: UseQueryOptions<RecurringScheduleTemplateInterface[], Error>,
) => {
  return useQuery({
    queryKey: recurring_schedule_template_query_keys.list(),
    queryFn: async () => {
      const res = await getRecurringScheduleTemplateList()
      return res
    },
    select: useCallback((data: RecurringScheduleTemplateInterface[]) => data, []),
    ...options,
  })
}

export const useCreateRecurringScheduleTemplate = (
  options?: UseMutationOptions<
    RecurringScheduleTemplateInterface,
    Error,
    RecurringScheduleTemplateCreateBodyInterface
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: (body: RecurringScheduleTemplateCreateBodyInterface) =>
      createRecurringScheduleTemplate(body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: recurring_schedule_template_query_keys.all })
      toast.success('정기 일정이 생성되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '정기 일정 생성에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}
