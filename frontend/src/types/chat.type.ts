export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface ChatMessageInterface {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string
}

export interface MainChatHistoryResponseInterface {
  status: number
  message: string
  data: ChatMessageInterface[] | null
}

export interface MainChatSendBodyInterface {
  content: string
}

export interface MainChatSendResponseInterface {
  status: number
  message: string
  data: ChatMessageInterface | null
}

export interface AgentChatHistoryResponseInterface {
  status: number
  message: string
  data: AgentChatHistoryPageDataInterface | null
}

export interface AgentChatHistoryPageDataInterface {
  items: ChatMessageInterface[]
  nextBeforeId: number | null
  hasMore: boolean
}

export interface AgentChatSendBodyInterface {
  content: string
  mode?: 'CHAT' | 'TODO'
}

export interface AgentChatSendResponseInterface {
  status: number
  message: string
  data: ChatMessageInterface | null
}
