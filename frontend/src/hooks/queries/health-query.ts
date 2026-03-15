import { getHealth } from '@/services/health-service'
import type { HealthResponseInterface } from '@/types/health.type'
import { queryOptions, useQuery, type UseQueryOptions } from '@tanstack/react-query'

/** Query Key Factory (규칙 8.2) */
export const health_query_keys = {
  all: ['health'] as const,
}

/** 재사용용 쿼리 옵션. enabled: false → 버튼 클릭 시 refetch() 호출 (규칙 8.3) */
export const health_query_options = queryOptions({
  queryKey: health_query_keys.all,
  queryFn: getHealth,
  enabled: false,
})

/** 헬스 체크 쿼리 훅. options는 queryKey/queryFn 제외하고 덮어쓸 수 있음 */
export const useHealth = (
  options?: Omit<
    UseQueryOptions<
      HealthResponseInterface,
      Error,
      HealthResponseInterface,
      typeof health_query_keys.all
    >,
    'queryKey' | 'queryFn'
  >,
) => {
  return useQuery({
    ...health_query_options,
    ...options,
  })
}
