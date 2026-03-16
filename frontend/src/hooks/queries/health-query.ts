import { getHealth } from '@/services/health-service'
import type { HealthResponseInterface } from '@/types/health.type'
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useCallback } from 'react'

/** Query Key Factory (규칙 8.2) */
export const health_query_keys = {
  all: ['health'] as const,
}

/** 헬스 체크 쿼리 훅. options는 queryKey/queryFn 제외하고 덮어쓸 수 있음 */
export const useHealth = (options?: UseQueryOptions<HealthResponseInterface, Error>) => {
  return useQuery({
    queryKey: health_query_keys.all,
    queryFn: async () => {
      const res = await getHealth()
      return res
    },
    select: useCallback((data: HealthResponseInterface) => data, []),
    ...options,
  })
}
