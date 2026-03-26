import { API } from '@/lib/client'
import { useUserStore } from '@/stores/user.store'
import type {
  AgentChatHistoryResponseInterface,
  AgentChatHistoryPageDataInterface,
  AgentChatSendBodyInterface,
  AgentChatSendResponseInterface,
  ChatMessageInterface,
  MainChatHistoryResponseInterface,
  MainChatSendBodyInterface,
  MainChatSendResponseInterface,
} from '@/types/chat.type'

export async function getMainChatHistory(): Promise<ChatMessageInterface[]> {
  const res = await API.get<MainChatHistoryResponseInterface>('/api/chat/main')

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data
}

export async function sendMainChatMessage(
  body: MainChatSendBodyInterface,
): Promise<ChatMessageInterface> {
  const res = await API.post<MainChatSendResponseInterface, MainChatSendBodyInterface>(
    '/api/chat/main',
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '메인 에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}

export async function getAgentChatHistory(agent_id: number): Promise<ChatMessageInterface[]> {
  const res = await API.get<AgentChatHistoryResponseInterface>(`/api/chat/agents/${agent_id}`, {
    params: { limit: 15 },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data.items
}

export async function getAgentChatHistoryPage(params: {
  agentId: number
  beforeId?: number | null
  limit?: number
}): Promise<AgentChatHistoryPageDataInterface> {
  const res = await API.get<AgentChatHistoryResponseInterface>(
    `/api/chat/agents/${params.agentId}`,
    {
      params: {
        beforeId: params.beforeId ?? undefined,
        limit: params.limit ?? 15,
      },
    },
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트 대화 내역을 불러오지 못했습니다.')
  }

  return res.data
}

export async function sendAgentChatMessage(
  agent_id: number,
  body: AgentChatSendBodyInterface,
): Promise<ChatMessageInterface> {
  const res = await API.post<AgentChatSendResponseInterface, AgentChatSendBodyInterface>(
    `/api/chat/agents/${agent_id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '에이전트에게 메시지를 보내지 못했습니다.')
  }

  return res.data
}

type StreamEvent =
  | { type: 'started' }
  | { type: 'delta'; text: string }
  | { type: 'final'; message: ChatMessageInterface }
  | { type: 'error'; message: string }

const readNdjsonStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) => {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    if (signal?.aborted) {
      try {
        await reader.cancel()
      } catch {
        // noop
      }
      throw new Error('요청이 취소되었습니다.')
    }

    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // 줄 단위(= NDJSON)로 파싱
    while (true) {
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) break
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (!line) continue
      try {
        const parsed = JSON.parse(line) as StreamEvent
        if (!parsed || typeof parsed !== 'object') continue
        onEvent(parsed)
      } catch {
        // 깨진 라인은 무시 (스트림 조각이 중간에 끊길 수 있음)
      }
    }
  }
}

const refreshAccessTokenOnce = async (): Promise<string | null> => {
  const baseUrl = import.meta.env.VITE_PUBLIC_API as string | undefined
  if (!baseUrl) return null

  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { status: number; data: { accessToken: string } | null }
  const token = json?.data?.accessToken
  if (!token) return null
  useUserStore.getState().setAccessToken(token)
  return token
}

export async function sendAgentChatMessageStream(
  agent_id: number,
  body: AgentChatSendBodyInterface,
  params: {
    onDelta: (text: string) => void
    onFinal: (message: ChatMessageInterface) => void
    onError: (message: string) => void
    signal?: AbortSignal
  },
): Promise<void> {
  const baseUrl = import.meta.env.VITE_PUBLIC_API as string | undefined
  if (!baseUrl) throw new Error('VITE_PUBLIC_API is missing')

  const doFetch = async (accessToken: string | null) => {
    const res = await fetch(`${baseUrl}/api/chat/agents/${agent_id}/stream`, {
      method: 'POST',
      credentials: 'include',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return res
  }

  let token = useUserStore.getState().accessToken
  let res = await doFetch(token ?? null)

  // 401이면 refresh 한 번만 시도
  if (res.status === 401) {
    token = await refreshAccessTokenOnce()
    res = await doFetch(token)
  }

  if (!res.ok) {
    throw new Error('스트리밍 요청에 실패했습니다.')
  }

  const stream = res.body
  if (!stream) {
    throw new Error('스트리밍 응답이 비어 있습니다.')
  }

  let receivedFinal = false
  let streamErrorMessage: string | null = null
  try {
    await readNdjsonStream(
      stream,
      (event) => {
        if (event.type === 'delta') params.onDelta(event.text ?? '')
        if (event.type === 'final') {
          receivedFinal = true
          params.onFinal(event.message)
        }
        if (event.type === 'error') {
          streamErrorMessage = event.message ?? '오류가 발생했습니다.'
          params.onError(streamErrorMessage)
        }
      },
      params.signal,
    )

    if (!receivedFinal && streamErrorMessage) {
      throw new Error(streamErrorMessage)
    }
  } catch (error) {
    // 서버가 final 전송 후 소켓을 공격적으로 닫으면 브라우저가 청크 오류를 낼 수 있다.
    // final을 이미 받았다면 성공으로 간주한다.
    if (receivedFinal) return
    throw error
  }
}
