import { AiDashboardPage } from '@/pages/ai/ai-dashboard-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/ai')({
  component: AiDashboardPage,
})
