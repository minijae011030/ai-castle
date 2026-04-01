import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { chat_query_keys } from '@/hooks/queries/chat-query'
import { sendAgentChatMessage, sendAgentChatMessageStream } from '@/services/chat-service'
import type { ChatMessageInterface } from '@/types/chat.type'

interface UseAgentChatStreamParamsInterface {
  agentId: number | null
}

interface SendAgentChatStreamParamsInterface {
  content: string
  mode?: 'CHAT' | 'TODO'
  imageUrls?: string[]
  onBeforeStart?: () => void
  onSuccess?: () => void
  onFailureRestore?: () => void
}

export const useAgentChatStream = ({ agentId }: UseAgentChatStreamParamsInterface) => {
  const queryClient = useQueryClient()
  const [isStreamingReply, setIsStreamingReply] = useState(false)
  const streamAbortRef = useRef<AbortController | null>(null)
  const streamAssistantLocalIdRef = useRef<string | null>(null)
  const streamDeltaQueueRef = useRef<string[]>([])
  const streamDeltaTimerRef = useRef<number | null>(null)
  const pendingFinalMessageRef = useRef<ChatMessageInterface | null>(null)

  const stopDeltaTypingLoop = useCallback(() => {
    if (streamDeltaTimerRef.current !== null) {
      window.clearInterval(streamDeltaTimerRef.current)
      streamDeltaTimerRef.current = null
    }
    streamDeltaQueueRef.current = []
    pendingFinalMessageRef.current = null
    streamAssistantLocalIdRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopDeltaTypingLoop()
    }
  }, [stopDeltaTypingLoop])

  const sendStreamMessage = useCallback(
    async ({
      content,
      mode,
      imageUrls,
      onBeforeStart,
      onSuccess,
      onFailureRestore,
    }: SendAgentChatStreamParamsInterface): Promise<boolean> => {
      if (agentId === null) return false

      setIsStreamingReply(true)
      onBeforeStart?.()

      const now = new Date().toISOString()
      const optimisticMode = mode ?? 'CHAT'
      const safeImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : null
      const userLocalId = `local-user-${now}-${Math.random().toString(16).slice(2)}`
      const assistantLocalId = `local-assistant-${now}-${Math.random().toString(16).slice(2)}`
      streamAssistantLocalIdRef.current = assistantLocalId
      const queryKey = chat_query_keys.agent_infinite(agentId)

      queryClient.setQueryData(queryKey, (old: unknown) => {
        const userMessage: ChatMessageInterface = {
          id: userLocalId,
          role: 'USER',
          mode: optimisticMode,
          content,
          createdAt: now,
          imageUrls: safeImageUrls,
        }
        const skeletonMessage: ChatMessageInterface = {
          id: assistantLocalId,
          role: 'ASSISTANT',
          mode: optimisticMode,
          content: '',
          createdAt: now,
          progressNotes: [],
        }

        if (!old || typeof old !== 'object' || !('pages' in old)) {
          return {
            pages: [{ items: [userMessage, skeletonMessage], nextBeforeId: null, hasMore: false }],
            pageParams: [null],
          }
        }

        const typed = old as {
          pages: Array<{ items: ChatMessageInterface[] }>
          pageParams: unknown[]
        }
        if (typed.pages.length === 0) {
          return {
            ...typed,
            pages: [{ items: [userMessage, skeletonMessage], nextBeforeId: null, hasMore: false }],
          }
        }

        const pages = [...typed.pages]
        pages[0] = { ...pages[0], items: [...pages[0].items, userMessage, skeletonMessage] }
        return { ...typed, pages }
      })

      const replaceAssistantMessage = (
        updater: (message: ChatMessageInterface) => ChatMessageInterface,
      ) => {
        queryClient.setQueryData(queryKey, (old: unknown) => {
          if (!old || typeof old !== 'object' || !('pages' in old)) return old
          const typed = old as {
            pages: Array<{ items: ChatMessageInterface[] }>
            pageParams: unknown[]
          }
          if (typed.pages.length === 0) return old
          const currentAssistantLocalId = streamAssistantLocalIdRef.current
          if (!currentAssistantLocalId) return old
          const pages = [...typed.pages]
          pages[0] = {
            ...pages[0],
            items: pages[0].items.map((message) =>
              message.id === currentAssistantLocalId ? updater(message) : message,
            ),
          }
          return { ...typed, pages }
        })
      }

      const appendProgressNote = (rawNote: string) => {
        const nextNote = (rawNote ?? '').trim()
        if (!nextNote) return
        replaceAssistantMessage((message) => {
          const previousNotes = message.progressNotes ?? []
          if (previousNotes[previousNotes.length - 1] === nextNote) {
            return message
          }
          return {
            ...message,
            progressNotes: [...previousNotes, nextNote],
          }
        })
      }

      const isProgressDelta = (deltaText: string) => {
        if (mode === 'CHAT') return false
        const normalized = (deltaText ?? '').trim()
        if (!normalized) return false
        return (
          normalized.startsWith('효율적인') ||
          normalized.startsWith('요청에서 날짜 범위를') ||
          normalized.includes('조회중') ||
          normalized.includes('조회하고 있어요') ||
          normalized.includes('확인하고 있어요') ||
          normalized.includes('추론하고 있어요') ||
          normalized.includes('점검하고 있어요') ||
          normalized.includes('정리해서') ||
          normalized.includes('추천안을 만들고 있어요') ||
          normalized.includes('초안을 만들고 있어요') ||
          normalized.includes('저장하고') ||
          normalized.includes('생성하고 있어요') ||
          normalized.includes('계획하고') ||
          normalized.includes('실행하고 있어요') ||
          normalized.includes('축약하고 있어요') ||
          normalized.includes('분석중') ||
          normalized.includes('분석하고 있어요') ||
          normalized.includes('반영하고 있어요') ||
          normalized.includes('시간 제약') ||
          normalized.includes('스코어를 계산하고 있어요') ||
          normalized.includes('소요 시간을 추정하고 있어요') ||
          normalized.includes('분할하고 있어요') ||
          normalized.includes('삽입하고 있어요') ||
          normalized.includes('재확인하고 있어요') ||
          normalized.includes('리스크를 점검하고 있어요') ||
          normalized.includes('요약 문구를 정리하고 있어요') ||
          normalized.includes('정리하고 있어요') ||
          normalized.includes('계산') ||
          normalized.includes('생성중') ||
          normalized.includes('검증하고 있어요') ||
          normalized.includes('해석') ||
          normalized.endsWith('...')
        )
      }

      const startDeltaTypingLoop = () => {
        if (streamDeltaTimerRef.current !== null) return
        streamDeltaTimerRef.current = window.setInterval(() => {
          const queue = streamDeltaQueueRef.current
          if (queue.length === 0) {
            if (pendingFinalMessageRef.current) {
              replaceAssistantMessage((message) => ({
                ...(pendingFinalMessageRef.current as ChatMessageInterface),
                progressNotes: message.progressNotes ?? null,
              }))
              pendingFinalMessageRef.current = null
              stopDeltaTypingLoop()
            }
            return
          }

          const chunk = queue[0]
          if (!chunk) {
            queue.shift()
            return
          }

          const slice = chunk.slice(0, 2)
          replaceAssistantMessage((message) => ({
            ...message,
            content: `${message.content ?? ''}${slice}`,
          }))

          const rest = chunk.slice(2)
          if (!rest) queue.shift()
          else queue[0] = rest
        }, 18)
      }

      try {
        streamAbortRef.current?.abort()
        const abortController = new AbortController()
        streamAbortRef.current = abortController

        await sendAgentChatMessageStream(
          agentId,
          { content, mode, imageUrls: safeImageUrls ?? undefined },
          {
            signal: abortController.signal,
            onDelta: (text) => {
              if (isProgressDelta(text ?? '')) {
                appendProgressNote(text ?? '')
                return
              }
              streamDeltaQueueRef.current.push(text ?? '')
              startDeltaTypingLoop()
            },
            onFinal: (finalMessage) => {
              pendingFinalMessageRef.current = finalMessage
              if (streamDeltaQueueRef.current.length === 0) {
                replaceAssistantMessage((message) => ({
                  ...finalMessage,
                  progressNotes: message.progressNotes ?? null,
                }))
                pendingFinalMessageRef.current = null
                stopDeltaTypingLoop()
              }
            },
            onError: (errorMessage) => {
              stopDeltaTypingLoop()
              toast.error(errorMessage ?? '실시간 전송 중 오류가 발생했습니다.')
            },
          },
        )
        onSuccess?.()
        return true
      } catch {
        stopDeltaTypingLoop()

        try {
          const fallbackMessage = await sendAgentChatMessage(agentId, {
            content,
            mode,
            imageUrls: safeImageUrls ?? undefined,
          })
          replaceAssistantMessage((message) => ({
            ...fallbackMessage,
            progressNotes: message.progressNotes ?? null,
          }))
          onSuccess?.()
          return true
        } catch {
          toast.error('스트리밍 전송에 실패했습니다.')
          onFailureRestore?.()
          queryClient.invalidateQueries({ queryKey })
          return false
        }
      } finally {
        if (streamDeltaQueueRef.current.length === 0 && !pendingFinalMessageRef.current) {
          stopDeltaTypingLoop()
        }
        setIsStreamingReply(false)
      }
    },
    [agentId, queryClient, stopDeltaTypingLoop],
  )

  return {
    isStreamingReply,
    sendStreamMessage,
  }
}
