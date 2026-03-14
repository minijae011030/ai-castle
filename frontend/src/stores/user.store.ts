import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 로그인 사용자 정보 (나중에 /me 등으로 채울 수 있음) */
export interface UserInfoInterface {
  user_id: number
  email: string
  user_name: string
}

interface UserState {
  accessToken: string | null
  userInfo: UserInfoInterface | null
  setAccessToken: (token: string | null) => void
  setUserInfo: (info: UserInfoInterface | null) => void
  /** 로그인 성공 시 호출. userInfo는 선택 (추후 /me 연동 시 설정) */
  setAuth: (accessToken: string, userInfo?: UserInfoInterface | null) => void
  /** 로그아웃 시 호출 */
  clearAuth: () => void
}

const initial_state = {
  accessToken: null as string | null,
  userInfo: null as UserInfoInterface | null,
}

/** React 컴포넌트에서는 useUserStore, client/auth-service 등에서는 useUserStore.getState() 사용 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initial_state,
      setAccessToken: (token) => set({ accessToken: token }),
      setUserInfo: (info) => set({ userInfo: info }),
      setAuth: (accessToken, userInfo = null) => set({ accessToken, userInfo: userInfo ?? null }),
      clearAuth: () => set(initial_state),
    }),
    {
      name: 'aicastle-user',
      partialize: (state: UserState) => ({
        accessToken: state.accessToken,
        userInfo: state.userInfo,
      }),
    },
  ),
)
