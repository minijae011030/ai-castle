import { API } from '@/lib/client'
import type {
  AgentRoleCreateBodyInterface,
  AgentRoleCreateResponseInterface,
  AgentRoleDataInterface,
  AgentRoleListResponseInterface,
  AgentRoleUpdateBodyInterface,
  AgentRoleUpdateResponseInterface,
} from '@/types/agent.type'

const BASE = '/api/agents'

export async function get_agent_role_list(): Promise<AgentRoleDataInterface[]> {
  const res = await API.get<AgentRoleListResponseInterface>(BASE)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function create_agent_role(
  body: AgentRoleCreateBodyInterface,
): Promise<AgentRoleDataInterface> {
  const res = await API.post<AgentRoleCreateResponseInterface, AgentRoleCreateBodyInterface>(
    BASE,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트를 생성하지 못했습니다.')
  }

  return res.data
}

export async function update_agent_role(
  id: number,
  body: AgentRoleUpdateBodyInterface,
): Promise<AgentRoleDataInterface> {
  const res = await API.patch<AgentRoleUpdateResponseInterface, AgentRoleUpdateBodyInterface>(
    `${BASE}/${id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트를 수정하지 못했습니다.')
  }

  return res.data
}
