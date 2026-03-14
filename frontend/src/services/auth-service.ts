import { API } from '@/lib/client'
import { useUserStore } from '@/stores/user.store'
import type {
  AuthLoginResponseInterface,
  LoginRequestInterface,
  LoginResponseDataInterface,
} from '@/types/auth.type'

/** 로그인. 성공 시 accessToken을 스토어에 저장, refreshToken은 쿠키로 설정됨. */
export async function login(body: LoginRequestInterface): Promise<LoginResponseDataInterface> {
  const res = await API.post<AuthLoginResponseInterface>('/api/auth/login', body)

  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(res.message ?? '로그인에 실패했습니다.')
  }

  useUserStore.getState().setAuth(res.data.accessToken)
  return res.data
}

/** 로그아웃 시 스토어 초기화 (accessToken, userInfo 제거) */
export function clearAuth(): void {
  useUserStore.getState().clearAuth()
}
