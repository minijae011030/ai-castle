import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/lib/route-auth'

/** 인증 필요 라우트 레이아웃. 토큰 없으면 /login으로 리다이렉트 */
export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    requireAuth()
  },
  component: () => <Outlet />,
})
