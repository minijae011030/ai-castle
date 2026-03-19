import {
  createAgentRole,
  createAgentPinnedMemory,
  deleteAgentPinnedMemory,
  getActiveAgentList,
  getAgentPinnedMemoryList,
  getAgentRoleList,
  updateAgentPinnedMemory,
  updateAgentRole,
} from '@/services/agent-service'
import type {
  AgentRoleCreateBodyInterface,
  AgentRoleDataInterface,
  AgentRoleUpdateBodyInterface,
  ActiveAgentDataInterface,
} from '@/types/agent.type'
import type {
  AgentPinnedMemoryCreateBodyInterface,
  AgentPinnedMemoryInterface,
  AgentPinnedMemoryUpdateBodyInterface,
} from '@/types/agent-memory.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

// 에이전트 관련 쿼리 키
export const agent_query_keys = {
  all: ['agent'] as const,
  list: () => [...agent_query_keys.all, 'list'] as const,
  active_list: () => [...agent_query_keys.all, 'active_list'] as const,
  pinned_memory_list: (agent_id: number) =>
    [...agent_query_keys.all, 'pinned_memory_list', agent_id] as const,
}

// 에이전트 롤 목록 조회 훅
export const useAgentRoleList = (options?: UseQueryOptions<AgentRoleDataInterface[], Error>) => {
  return useQuery({
    queryKey: agent_query_keys.list(),
    queryFn: async () => {
      const res = await getAgentRoleList()
      return res
    },
    select: useCallback((data: AgentRoleDataInterface[]) => data, []),
    ...options,
  })
}

// 활성 에이전트 목록 조회 훅 (id + name)
export const useActiveAgentList = (
  options?: UseQueryOptions<ActiveAgentDataInterface[], Error>,
) => {
  return useQuery({
    queryKey: agent_query_keys.active_list(),
    queryFn: async () => {
      const res = await getActiveAgentList()
      return res
    },
    select: useCallback((data: ActiveAgentDataInterface[]) => data, []),
    ...options,
  })
}

// 에이전트 고정 메모리 목록 조회 훅
export const useAgentPinnedMemoryList = (
  agent_id: number,
  options?: UseQueryOptions<AgentPinnedMemoryInterface[], Error>,
) => {
  return useQuery({
    queryKey: agent_query_keys.pinned_memory_list(agent_id),
    queryFn: async () => {
      const res = await getAgentPinnedMemoryList(agent_id)
      return res
    },
    enabled: agent_id > 0,
    select: useCallback((data: AgentPinnedMemoryInterface[]) => data, []),
    ...options,
  })
}

// 에이전트 고정 메모리 추가 훅
export const useCreateAgentPinnedMemory = (
  agent_id: number,
  options?: UseMutationOptions<
    AgentPinnedMemoryInterface,
    Error,
    AgentPinnedMemoryCreateBodyInterface
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgentPinnedMemoryCreateBodyInterface) => {
      const result = await createAgentPinnedMemory(agent_id, body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.pinned_memory_list(agent_id) })
      toast.success('메모리가 저장되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '메모리를 저장하지 못했습니다.')
    },
    ...options,
  })
}

// 에이전트 고정 메모리 삭제 훅
export const useDeleteAgentPinnedMemory = (
  agent_id: number,
  options?: UseMutationOptions<void, Error, { memory_id: number }>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async ({ memory_id }: { memory_id: number }) => {
      await deleteAgentPinnedMemory(agent_id, memory_id)
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.pinned_memory_list(agent_id) })
      toast.success('메모리가 삭제되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '메모리를 삭제하지 못했습니다.')
    },
    ...options,
  })
}

// 에이전트 고정 메모리 수정 훅
export const useUpdateAgentPinnedMemory = (
  agent_id: number,
  options?: UseMutationOptions<
    AgentPinnedMemoryInterface,
    Error,
    { memory_id: number; body: AgentPinnedMemoryUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async ({
      memory_id,
      body,
    }: {
      memory_id: number
      body: AgentPinnedMemoryUpdateBodyInterface
    }) => {
      const result = await updateAgentPinnedMemory(agent_id, memory_id, body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.pinned_memory_list(agent_id) })
      toast.success('메모리가 수정되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '메모리를 수정하지 못했습니다.')
    },
    ...options,
  })
}

// 에이전트 롤 생성 훅
export const useCreateAgentRole = (
  options?: UseMutationOptions<AgentRoleDataInterface, Error, AgentRoleCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgentRoleCreateBodyInterface) => {
      const result = await createAgentRole(body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.all })
      toast.success('에이전트가 생성되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '에이전트를 생성하지 못했습니다.')
    },
    ...options,
  })
}

// 에이전트 롤 수정 훅
export const useUpdateAgentRole = (
  options?: UseMutationOptions<
    AgentRoleDataInterface,
    Error,
    { id: number; body: AgentRoleUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AgentRoleUpdateBodyInterface }) => {
      const result = await updateAgentRole(id, body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.all })
      toast.success('에이전트가 수정되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '에이전트를 수정하지 못했습니다.')
    },
    ...options,
  })
}
