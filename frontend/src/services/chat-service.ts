import { API } from '@/lib/client'
import type {
  AgentChatHistoryResponseInterface,
  AgentChatHistoryPageDataInterface,
  AgentChatSendBodyInterface,
  AgentChatSendResponseInterface,
  ChatMessageInterface,
  MainChatHistoryResponseInterface,
  MainChatSendBodyInterface,
  MainChatSendResponseInterface,
} from '@/types/chat.type'

export async function getMainChatHistory(): Promise<ChatMessageInterface[]> {
  const res = await API.get<MainChatHistoryResponseInterface>('/api/chat/main')

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data
}

export async function sendMainChatMessage(
  body: MainChatSendBodyInterface,
): Promise<ChatMessageInterface> {
  const res = await API.post<MainChatSendResponseInterface, MainChatSendBodyInterface>(
    '/api/chat/main',
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}

export async function getAgentChatHistory(agent_id: number): Promise<ChatMessageInterface[]> {
  const res = await API.get<AgentChatHistoryResponseInterface>(`/api/chat/agents/${agent_id}`, {
    params: { limit: 15 },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data.items
}

export async function getAgentChatHistoryPage(params: {
  agentId: number
  beforeId?: number | null
  limit?: number
}): Promise<AgentChatHistoryPageDataInterface> {
  const res = await API.get<AgentChatHistoryResponseInterface>(
    `/api/chat/agents/${params.agentId}`,
    {
      params: {
        beforeId: params.beforeId ?? undefined,
        limit: params.limit ?? 15,
      },
    },
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data
}

export async function sendAgentChatMessage(
  agent_id: number,
  body: AgentChatSendBodyInterface,
): Promise<ChatMessageInterface> {
  const res = await API.post<AgentChatSendResponseInterface, AgentChatSendBodyInterface>(
    `/api/chat/agents/${agent_id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}
