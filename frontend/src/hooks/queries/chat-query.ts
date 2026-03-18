import {
  getAgentChatHistory,
  getMainChatHistory,
  sendAgentChatMessage,
  sendMainChatMessage,
} from '@/services/chat-service'
import type {
  AgentChatSendBodyInterface,
  ChatMessageInterface,
  MainChatSendBodyInterface,
} from '@/types/chat.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export const chat_query_keys = {
  all: ['chat'] as const,
  main: () => [...chat_query_keys.all, 'main'] as const,
  agent: (agent_id: number) => [...chat_query_keys.all, 'agent', agent_id] as const,
}

// 메인 에이전트 채팅 히스토리 조회 훅
export const useMainChatHistory = (options?: UseQueryOptions<ChatMessageInterface[], Error>) => {
  return useQuery({
    queryKey: chat_query_keys.main(),
    queryFn: async () => {
      const result = await getMainChatHistory()
      return result
    },
    select: useCallback((data: ChatMessageInterface[]) => data, []),
    ...options,
  })
}

// 메인 에이전트 채팅 메시지 전송 훅
export const useSendMainChatMessage = (
  options?: UseMutationOptions<ChatMessageInterface, Error, MainChatSendBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (body: MainChatSendBodyInterface) => {
      const result = await sendMainChatMessage(body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: chat_query_keys.main() })
    },
    onError: (error) => {
      toast.error(error.message ?? '메시지 전송에 실패했습니다.')
    },
    ...options,
  })
}

// 서브 에이전트 채팅 히스토리 조회 훅
export const useAgentChatHistory = (
  agent_id: number,
  options?: UseQueryOptions<ChatMessageInterface[], Error>,
) => {
  return useQuery({
    queryKey: chat_query_keys.agent(agent_id),
    queryFn: async () => {
      const result = await getAgentChatHistory(agent_id)
      return result
    },
    enabled: agent_id > 0,
    select: useCallback((data: ChatMessageInterface[]) => data, []),
    ...options,
  })
}

// 서브 에이전트 채팅 메시지 전송 훅
export const useSendAgentChatMessage = (
  agent_id: number,
  options?: UseMutationOptions<ChatMessageInterface, Error, AgentChatSendBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (body: AgentChatSendBodyInterface) => {
      const result = await sendAgentChatMessage(agent_id, body)
      return result
    },
    onMutate: async (variables) => {
      await query_client.cancelQueries({ queryKey: chat_query_keys.agent(agent_id) })
      const previous = query_client.getQueryData<ChatMessageInterface[]>(
        chat_query_keys.agent(agent_id),
      )

      const now = new Date().toISOString()
      const userMessage: ChatMessageInterface = {
        id: `local-user-${now}-${Math.random().toString(16).slice(2)}`,
        role: 'USER',
        content: variables.content,
        createdAt: now,
      }

      query_client.setQueryData<ChatMessageInterface[]>(chat_query_keys.agent(agent_id), (old) => [
        ...(old ?? []),
        userMessage,
      ])

      const ctx = { previous }
      await options?.onMutate?.(variables)
      return ctx
    },
    onSuccess: (data, variables, context, mutation) => {
      query_client.setQueryData<ChatMessageInterface[]>(chat_query_keys.agent(agent_id), (old) => [
        ...(old ?? []),
        data,
      ])
      query_client.invalidateQueries({ queryKey: chat_query_keys.agent(agent_id) })
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      if (context?.previous) {
        query_client.setQueryData(chat_query_keys.agent(agent_id), context.previous)
      }
      toast.error(error.message ?? '메시지 전송에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    onSettled: (data, error, variables, context) => {
      options?.onSettled?.(data, error, variables, context)
    },
  })
}
