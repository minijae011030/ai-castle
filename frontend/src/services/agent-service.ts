import { API } from '@/lib/client'
import type {
  AgentRoleCreateBodyInterface,
  AgentRoleCreateResponseInterface,
  AgentRoleDataInterface,
  AgentRoleListResponseInterface,
  AgentRoleUpdateBodyInterface,
  AgentRoleUpdateResponseInterface,
  ActiveAgentDataInterface,
  ActiveAgentListResponseInterface,
} from '@/types/agent.type'
import type {
  AgentPinnedMemoryCreateBodyInterface,
  AgentPinnedMemoryCreateResponseInterface,
  AgentPinnedMemoryDeleteResponseInterface,
  AgentPinnedMemoryInterface,
  AgentPinnedMemoryListResponseInterface,
} from '@/types/agent-memory.type'

export async function getAgentRoleList(): Promise<AgentRoleDataInterface[]> {
  const res = await API.get<AgentRoleListResponseInterface>('/api/agents')

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function createAgentRole(
  body: AgentRoleCreateBodyInterface,
): Promise<AgentRoleDataInterface> {
  const res = await API.post<AgentRoleCreateResponseInterface, AgentRoleCreateBodyInterface>(
    '/api/agents',
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트를 생성하지 못했습니다.')
  }

  return res.data
}

export async function updateAgentRole(
  id: number,
  body: AgentRoleUpdateBodyInterface,
): Promise<AgentRoleDataInterface> {
  const res = await API.patch<AgentRoleUpdateResponseInterface, AgentRoleUpdateBodyInterface>(
    `/api/agents/${id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트를 수정하지 못했습니다.')
  }

  return res.data
}

export async function getActiveAgentList(): Promise<ActiveAgentDataInterface[]> {
  const res = await API.get<ActiveAgentListResponseInterface>('/api/agents/active')

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '활성 에이전트 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function getAgentPinnedMemoryList(
  agent_id: number,
): Promise<AgentPinnedMemoryInterface[]> {
  const res = await API.get<AgentPinnedMemoryListResponseInterface>(
    `/api/agents/${agent_id}/memory`,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 메모리를 불러오지 못했습니다.')
  }

  return res.data.items
}

export async function createAgentPinnedMemory(
  agent_id: number,
  body: AgentPinnedMemoryCreateBodyInterface,
): Promise<AgentPinnedMemoryInterface> {
  const res = await API.post<
    AgentPinnedMemoryCreateResponseInterface,
    AgentPinnedMemoryCreateBodyInterface
  >(`/api/agents/${agent_id}/memory`, body)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메모리를 저장하지 못했습니다.')
  }

  return res.data
}

export async function deleteAgentPinnedMemory(agent_id: number, memory_id: number): Promise<void> {
  const res = await API.delete<AgentPinnedMemoryDeleteResponseInterface>(
    `/api/agents/${agent_id}/memory/${memory_id}`,
  )

  if (res.status !== 200) {
    throw new Error(res.message ?? '메모리를 삭제하지 못했습니다.')
  }
}
