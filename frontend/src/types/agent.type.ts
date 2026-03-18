export interface AgentRoleDataInterface {
  id: number
  name: string
  roleType: 'MAIN' | 'SUB'
  systemPrompt: string
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
}

export interface AgentRoleCreateResponseInterface {
  status: number
  message: string
  data: AgentRoleDataInterface | null
}

export interface AgentRoleUpdateBodyInterface {
  systemPrompt: string
}

export interface AgentRoleUpdateResponseInterface {
  status: number
  message: string
  data: AgentRoleDataInterface | null
}

export interface ActiveAgentDataInterface {
  id: number
  name: string
}

export interface ActiveAgentListResponseInterface {
  status: number
  message: string
  data: ActiveAgentDataInterface[] | null
}
