import { create_agent_role, get_agent_role_list, update_agent_role } from '@/services/agent-service'
import type {
  AgentRoleCreateBodyInterface,
  AgentRoleDataInterface,
  AgentRoleUpdateBodyInterface,
} from '@/types/agent.type'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const agent_query_keys = {
  all: ['agent'] as const,
  list: () => [...agent_query_keys.all, 'list'] as const,
}

export const agent_role_list_query_options = queryOptions({
  queryKey: agent_query_keys.list(),
  queryFn: get_agent_role_list,
})

export const useAgentRoleList = (
  options?: Omit<UseQueryOptions<AgentRoleDataInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...agent_role_list_query_options,
    ...options,
  })
}

export const useCreateAgentRole = (
  options?: UseMutationOptions<AgentRoleDataInterface, Error, AgentRoleCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: create_agent_role,
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.all })
      toast.success('에이전트가 생성되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '에이전트를 생성하지 못했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}

export const useUpdateAgentRole = (
  options?: UseMutationOptions<
    AgentRoleDataInterface,
    Error,
    { id: number; body: AgentRoleUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: ({ id, body }) => update_agent_role(id, body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.all })
      toast.success('에이전트가 수정되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '에이전트를 수정하지 못했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}
