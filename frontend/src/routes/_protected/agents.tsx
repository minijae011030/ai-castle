import { AgentListPage } from '@/pages/agents/agent-list-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/agents')({
  component: AgentListPage,
})
