import { AgentChatPage } from '@/pages/agents/agent-chat-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/agents/$agentId/chat')({
  component: AgentChatPage,
})
