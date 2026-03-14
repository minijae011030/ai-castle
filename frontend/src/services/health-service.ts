import { API } from '@/lib/client'
import type { HealthResponseInterface } from '@/types/health.type'

/** 헬스 체크 API 호출. 연결 실패 시 에러 throw */
export async function getHealth(): Promise<HealthResponseInterface> {
  const res = await API.get<HealthResponseInterface>('/api/health')

  if (res.status !== 200) {
    throw new Error(res.message ?? '헬스 체크 실패')
  }

  return res
}
