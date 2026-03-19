export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TodoStatus = 'TODO' | 'DONE'

export interface TodoItemInterface {
  title: string
  description: string | null
  estimateMinutes: number | null
  priority: TodoPriority
  status: TodoStatus
  scheduledDate: string
  startAt: string
  endAt: string
}

export interface ChatMessageInterface {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string
  todo?: TodoItemInterface[] | null
}

export interface MainChatHistoryResponseInterface {
  status: number
  message: string
  data: ChatMessageInterface[] | null
}

export interface MainChatSendBodyInterface {
  content: string
  mode: 'CHAT' | 'TODO'
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
  mode: 'CHAT' | 'TODO'
}

export interface AgentChatSendResponseInterface {
  status: number
  message: string
  data: ChatMessageInterface | null
}
