import { getRecurringScheduleTemplateList } from '@/services/recurring-schedule-template-service'
import type { RecurringScheduleTemplateInterface } from '@/types/recurring-schedule-template.type'
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useCallback } from 'react'

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
