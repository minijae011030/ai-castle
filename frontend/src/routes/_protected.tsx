import { AppSidebar } from '@/components/layouts/app-sidebar'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/route-auth'

/** 인증 필요 라우트 레이아웃. 사이드바 + 본문(Outlet) */
export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    requireAuth()
  },
  component: AppSidebar,
})
