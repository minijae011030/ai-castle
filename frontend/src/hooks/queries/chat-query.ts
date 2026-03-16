import {
  get_agent_chat_history,
  get_main_chat_history,
  send_agent_chat_message,
  send_main_chat_message,
} from '@/services/chat-service'
import type {
  AgentChatSendBodyInterface,
  ChatMessageInterface,
  MainChatSendBodyInterface,
} from '@/types/chat.type'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const chat_query_keys = {
  all: ['chat'] as const,
  main: () => [...chat_query_keys.all, 'main'] as const,
  agent: (agent_id: number) => [...chat_query_keys.all, 'agent', agent_id] as const,
}

export const main_chat_history_query_options = queryOptions({
  queryKey: chat_query_keys.main(),
  queryFn: get_main_chat_history,
})

export const useMainChatHistory = (
  options?: Omit<UseQueryOptions<ChatMessageInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...main_chat_history_query_options,
    ...options,
  })
}

export const useSendMainChatMessage = (
  options?: UseMutationOptions<ChatMessageInterface, Error, MainChatSendBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: send_main_chat_message,
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: chat_query_keys.main() })
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '메시지 전송에 실패했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}

export const useAgentChatHistory = (
  agent_id: number,
  options?: Omit<UseQueryOptions<ChatMessageInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    queryKey: chat_query_keys.agent(agent_id),
    queryFn: () => get_agent_chat_history(agent_id),
    ...options,
  })
}

export const useSendAgentChatMessage = (
  agent_id: number,
  options?: UseMutationOptions<ChatMessageInterface, Error, AgentChatSendBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: (body: AgentChatSendBodyInterface) => send_agent_chat_message(agent_id, body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: chat_query_keys.agent(agent_id) })
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '메시지 전송에 실패했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}
