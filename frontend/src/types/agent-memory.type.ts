export interface AgentPinnedMemoryInterface {
  id: number
  content: string
  createdAt: string
}

export interface AgentPinnedMemoryListDataInterface {
  items: AgentPinnedMemoryInterface[]
}

export interface AgentPinnedMemoryListResponseInterface {
  status: number
  message: string
  data: AgentPinnedMemoryListDataInterface | null
}

export interface AgentPinnedMemoryCreateBodyInterface {
  content: string
}

export interface AgentPinnedMemoryCreateResponseInterface {
  status: number
  message: string
  data: AgentPinnedMemoryInterface | null
}

export interface AgentPinnedMemoryDeleteResponseInterface {
  status: number
  message: string
  data: null
}
