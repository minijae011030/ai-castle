import { API } from '@/lib/client'
import type {
  AuthLoginResponseInterface,
  LoginRequestInterface,
  LoginResponseDataInterface,
} from '@/types/auth.type'

const ACCESS_TOKEN_KEY = 'accessToken'

/** 로그인. 성공 시 accessToken 저장, refreshToken은 쿠키로 설정됨. */
export async function login(body: LoginRequestInterface): Promise<LoginResponseDataInterface> {
  const res = await API.post<AuthLoginResponseInterface>('/api/auth/login', body)

  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(res.message ?? '로그인에 실패했습니다.')
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, res.data.accessToken)
  return res.data
}

/** 저장된 accessToken 제거 (로그아웃 시) */
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

/** 저장된 accessToken 조회 (client 인터셉터에서 사용) */
export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}
