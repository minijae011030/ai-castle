import { API } from '@/lib/client'
import type {
  AgentChatHistoryResponseInterface,
  AgentChatSendBodyInterface,
  AgentChatSendResponseInterface,
  ChatMessageInterface,
  MainChatHistoryResponseInterface,
  MainChatSendBodyInterface,
  MainChatSendResponseInterface,
} from '@/types/chat.type'

const MAIN_BASE = '/api/chat/main'
const AGENT_BASE = '/api/chat/agents'

export async function getMainChatHistory(): Promise<ChatMessageInterface[]> {
  const res = await API.get<MainChatHistoryResponseInterface>(MAIN_BASE)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data
}

export async function sendMainChatMessage(
  body: MainChatSendBodyInterface,
): Promise<ChatMessageInterface> {
  const res = await API.post<MainChatSendResponseInterface, MainChatSendBodyInterface>(
    MAIN_BASE,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}

export async function getAgentChatHistory(agent_id: number): Promise<ChatMessageInterface[]> {
  const res = await API.get<AgentChatHistoryResponseInterface>(`${AGENT_BASE}/${agent_id}`)

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
    `${AGENT_BASE}/${agent_id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}
