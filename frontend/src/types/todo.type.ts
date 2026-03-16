export type TodoStatus = 'PENDING' | 'NEGOTIATING' | 'ACCEPTED' | 'DONE' | 'CANCELLED'

export interface TodoAgentSummaryInterface {
  id: number
  name: string
}

export interface TodoItemInterface {
  id: number
  title: string
  description: string
  status: TodoStatus
  scheduledDate: string
  orderIndex: number
  agent: TodoAgentSummaryInterface
}

export interface TodoListResponseInterface {
  status: number
  message: string
  data: TodoItemInterface[] | null
}

export interface TodoCreateBodyInterface {
  agentRoleId: number
  title: string
  description?: string
  scheduledDate: string
  orderIndex?: number
}

export interface TodoCreateResponseInterface {
  status: number
  message: string
  data: TodoItemInterface | null
}

export interface TodoUpdateBodyInterface {
  title?: string
  description?: string
  scheduledDate?: string
  orderIndex?: number
  status?: TodoStatus
}

export interface TodoUpdateResponseInterface {
  status: number
  message: string
  data: TodoItemInterface | null
}

export interface TodoStatusUpdateBodyInterface {
  status: TodoStatus
}

export interface TodoStatusUpdateResponseInterface {
  status: number
  message: string
  data: TodoItemInterface | null
}
