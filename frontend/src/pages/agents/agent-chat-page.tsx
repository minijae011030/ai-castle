import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useInfiniteAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { useAgentRoleList } from '@/hooks/queries/agent-query'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Route } from '@/routes/_protected/agents/$agentId.chat'
import { cn } from '@/lib/utils'
import { MarkdownMessage } from '@/components/chat/markdown-message'

export const AgentChatPage = () => {
  const params = Route.useParams()
  const router = useRouter()

  const agentId = Number(params.agentId)

  const { data: agents = [] } = useAgentRoleList()
  const {
    data: chatPages,
    isPending,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteAgentChatHistory(agentId)

  const agent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId])
  const [inputValue, setInputValue] = useState('')
  const [chatMode, setChatMode] = useState<'CHAT' | 'TODO'>('CHAT')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sendLockRef = useRef(false)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)

  const sendMutation = useSendAgentChatMessage(agentId, {
    onSettled: () => {
      sendLockRef.current = false
    },
  })

  // 에이전트 ID 유효성 검사
  useEffect(() => {
    if (!agentId || Number.isNaN(agentId)) {
      router.navigate({ to: '/agents' })
    }
  }, [agentId, router])

  // 채팅 스크롤 핸들러
  useEffect(() => {
    if (!scrollRef.current) return
    if (isFetchingNextPage) return

    // 과거 메시지 prepend 후에는 기존 위치를 보존한다.
    if (keepScrollOffsetRef.current) {
      const prev = keepScrollOffsetRef.current
      keepScrollOffsetRef.current = null
      const nextHeight = scrollRef.current.scrollHeight
      scrollRef.current.scrollTop = nextHeight - prev.height + prev.top
      return
    }

    // 기본 동작: 최신 메시지 도착 시 바닥으로 스크롤
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatPages?.pages?.length, chatPages?.pages?.[0]?.items?.length, isFetchingNextPage])

  const messages: ChatMessageInterface[] = useMemo(() => {
    const pages = chatPages?.pages ?? []
    if (pages.length === 0) return []

    const newestPage = pages[0]
    const olderPages = pages.slice(1)
    const systemItems = newestPage.items.filter((m) => m.role === 'SYSTEM')
    const newestNonSystem = newestPage.items.filter((m) => m.role !== 'SYSTEM')
    const olderChrono = [...olderPages].reverse().flatMap((p) => p.items)

    return [...systemItems, ...olderChrono, ...newestNonSystem]
  }, [chatPages])

  const handleScroll: React.UIEventHandler<HTMLDivElement> = async (event) => {
    const el = event.currentTarget
    if (el.scrollTop > 80) return
    if (!hasNextPage || isFetchingNextPage) return

    keepScrollOffsetRef.current = { top: el.scrollTop, height: el.scrollHeight }
    await fetchNextPage()
  }

  // 채팅 전송 핸들러
  const handleSend = () => {
    const content = inputValue.trim()
    if (!content || sendMutation.isPending || sendLockRef.current) return

    setInputValue('')
    sendLockRef.current = true
    sendMutation.mutate({ content, mode: chatMode })
  }

  // 채팅 입력창 엔터키 누르면 전송 핸들러
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    // 한글 입력(IME) 조합 중 Enter는 전송으로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  // 채팅 메시지 렌더링 핸들러
  const renderMessage = (message: ChatMessageInterface) => {
    const isUser = message.role === 'USER'
    const isAssistant = message.role === 'ASSISTANT'

    return (
      <div key={message.id} className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[70%] rounded-lg px-3 py-2 text-xs',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isAssistant
                ? 'bg-muted text-foreground'
                : 'bg-secondary text-secondary-foreground',
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
          ) : (
            <MarkdownMessage content={message.content} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">{agent ? agent.name : '에이전트 대화'}</h1>
          {agent && (
            <p className="text-xs text-muted-foreground">
              타입: {agent.roleType === 'MAIN' ? '메인 에이전트' : '서브 에이전트'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.navigate({ to: '/agents' })}
        >
          목록으로
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="py-3">
          <p className="text-xs text-muted-foreground">
            선택한 에이전트와 개별적으로 대화할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3 max-h-[min(1000px,calc(100dvh-320px))]"
            onScroll={handleScroll}
          >
            {isPending ? (
              <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
              </p>
            ) : (
              messages.map(renderMessage)
            )}
          </div>

          <div className="space-y-2">
            <Textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
            />
            <div className="flex items-center justify-between gap-2">
              <Select value={chatMode} onValueChange={(v) => setChatMode(v as 'CHAT' | 'TODO')}>
                <SelectTrigger size="sm" className="min-w-24">
                  <SelectValue placeholder="모드" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAT">대화</SelectItem>
                  <SelectItem value="TODO">투두</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMutation.isPending}
              >
                보내기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
