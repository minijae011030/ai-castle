import { createAgentRole, getAgentRoleList, updateAgentRole } from '@/services/agent-service'
import type {
  AgentRoleCreateBodyInterface,
  AgentRoleDataInterface,
  AgentRoleUpdateBodyInterface,
} from '@/types/agent.type'
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
