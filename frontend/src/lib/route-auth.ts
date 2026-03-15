import { redirect } from '@tanstack/react-router'
import { useUserStore } from '@/stores/user.store'
import { clearAuth } from '@/services/auth-service'

/** JWT payload의 exp(만료 시각) 검사. 파싱 실패·만료 시 false (서명 검증은 백엔드에서) */
function isTokenValid(token: string | null): boolean {
  if (!token || token.trim().length === 0) return false
  try {
    const payload_b64 = token.split('.')[1]
    if (!payload_b64) return false
    const payload_json = atob(payload_b64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payload_json) as { exp?: number }
    const exp = payload.exp
    if (typeof exp !== 'number') return false
    // 만료 10초 전부터 재발급 유도
    return exp * 1000 > Date.now() + 10_000
  } catch {
    return false
  }
}

/** 보호 라우트: 토큰 없거나 만료/손상이면 스토어 정리 후 /login으로 리다이렉트 */
export function requireAuth(): void {
  const token = useUserStore.getState().accessToken
  if (!isTokenValid(token)) {
    clearAuth()
    throw redirect({ to: '/login' })
  }
}

/** 게스트 전용: 유효한 토큰이 있으면 /로 리다이렉트 (invalid/만료 토큰은 그냥 통과) */
export function requireGuest(): void {
  const token = useUserStore.getState().accessToken
  if (isTokenValid(token)) {
    throw redirect({ to: '/' })
  }
}
