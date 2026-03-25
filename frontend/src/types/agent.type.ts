export interface AgentRoleDataInterface {
  id: number
  name: string
  roleType: 'MAIN' | 'SUB'
  systemPrompt: string
  mainAgentId: number | null
}

export interface AgentRoleListResponseInterface {
  status: number
  message: string
  data: AgentRoleDataInterface[] | null
}

export interface AgentRoleCreateBodyInterface {
  name: string
  roleType: 'MAIN' | 'SUB'
  systemPrompt: string
  mainAgentId?: number | null
}

export interface AgentRoleCreateResponseInterface {
  status: number
  message: string
  data: AgentRoleDataInterface | null
}

export interface AgentRoleUpdateBodyInterface {
  systemPrompt: string
  mainAgentId?: number | null
}

export interface AgentRoleUpdateResponseInterface {
  status: number
  message: string
  data: AgentRoleDataInterface | null
}

export interface ActiveAgentDataInterface {
  id: number
  name: string
  /** 서브가 속한 메인 에이전트 id (배치·오케스트레이션 그룹 키) */
  mainAgentId: number | null
}

export interface ActiveAgentListResponseInterface {
  status: number
  message: string
  data: ActiveAgentDataInterface[] | null
}

export interface TodoDraftItemInterface {
  draftId: string
  sourceScheduleId: number | null
  selected: boolean
  title: string
  description: string
  estimateMinutes: number | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'TODO' | 'DONE'
  scheduledDate: string
  startAt: string
  endAt: string
}

export type TodoWorkbenchDateFilterType = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'
export type TodoDraftPanelType = 'REGISTER' | 'ADJUST'
