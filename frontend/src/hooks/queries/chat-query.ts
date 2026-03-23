import {
  getAgentChatHistory,
  getAgentChatHistoryPage,
  getMainChatHistory,
  sendAgentChatMessage,
  sendMainChatMessage,
} from '@/services/chat-service'
import type {
  AgentChatHistoryPageDataInterface,
  AgentChatSendBodyInterface,
  ChatMessageInterface,
  MainChatSendBodyInterface,
} from '@/types/chat.type'
import {
  useInfiniteQuery,
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
  agent_infinite: (agent_id: number) =>
    [...chat_query_keys.all, 'agent', agent_id, 'infinite'] as const,
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

export const useInfiniteAgentChatHistory = (
  agent_id: number,
  options?: Parameters<typeof useInfiniteQuery<AgentChatHistoryPageDataInterface, Error>>[0],
) => {
  return useInfiniteQuery({
    queryKey: chat_query_keys.agent_infinite(agent_id),
    enabled: agent_id > 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const beforeId = (pageParam ?? null) as number | null
      const result = await getAgentChatHistoryPage({ agentId: agent_id, beforeId })
      return result
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextBeforeId : undefined),
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
      await query_client.cancelQueries({ queryKey: chat_query_keys.agent_infinite(agent_id) })
      const previous = query_client.getQueryData(chat_query_keys.agent_infinite(agent_id))

      const now = new Date().toISOString()
      const userMessage: ChatMessageInterface = {
        id: `local-user-${now}-${Math.random().toString(16).slice(2)}`,
        role: 'USER',
        mode: variables.mode,
        content: variables.content,
        createdAt: now,
        imageUrls: variables.imageUrls ?? null,
      }

      query_client.setQueryData(chat_query_keys.agent_infinite(agent_id), (old) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old
        const typed = old as { pages: AgentChatHistoryPageDataInterface[]; pageParams: unknown[] }
        if (typed.pages.length === 0) return old

        const pages = [...typed.pages]
        // 최신 페이지(첫 페이지)의 마지막에 유저 메시지를 추가
        const first = pages[0]
        pages[0] = { ...first, items: [...first.items, userMessage] }

        return { ...typed, pages }
      })

      const ctx = { previous }
      // 유저 옵션 콜백은 내부 처리 이후 호출(시그니처는 버전에 따라 달라질 수 있어 안전하게 처리)
      await (options?.onMutate as unknown as (v: AgentChatSendBodyInterface) => unknown)?.(
        variables,
      )
      return ctx
    },
    onSuccess: (data, variables, context) => {
      query_client.setQueryData(chat_query_keys.agent_infinite(agent_id), (old) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old
        const typed = old as { pages: AgentChatHistoryPageDataInterface[]; pageParams: unknown[] }
        if (typed.pages.length === 0) return old

        const pages = [...typed.pages]
        const first = pages[0]
        pages[0] = { ...first, items: [...first.items, data] }

        return { ...typed, pages }
      })
      query_client.invalidateQueries({ queryKey: chat_query_keys.agent_infinite(agent_id) })
      ;(
        options?.onSuccess as unknown as (
          d: ChatMessageInterface,
          v: AgentChatSendBodyInterface,
          c: unknown,
        ) => unknown
      )?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        query_client.setQueryData(chat_query_keys.agent_infinite(agent_id), context.previous)
      }
      toast.error(error.message ?? '메시지 전송에 실패했습니다.')
      ;(
        options?.onError as unknown as (
          e: Error,
          v: AgentChatSendBodyInterface,
          c: unknown,
        ) => unknown
      )?.(error, variables, context)
    },
    onSettled: (data, error, variables, context) => {
      ;(
        options?.onSettled as unknown as (
          d: ChatMessageInterface | undefined,
          e: Error | null,
          v: AgentChatSendBodyInterface,
          c: unknown,
        ) => unknown
      )?.(data, error, variables, context)
    },
  })
}
