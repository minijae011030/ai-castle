import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useMainChatHistory, useSendMainChatMessage } from '@/hooks/queries/chat-query'
import { cn } from '@/lib/utils'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useEffect, useRef, useState } from 'react'

const AiDashboardPage = () => {
  const { data: messages = [], isPending } = useMainChatHistory()
  const sendMutation = useSendMainChatMessage()

  const [inputValue, setInputValue] = useState('')
  const scroll_ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!scroll_ref.current) return
    scroll_ref.current.scrollTop = scroll_ref.current.scrollHeight
  }, [messages.length])

  const handleSend = () => {
    const content = inputValue.trim()
    if (!content || sendMutation.isPending) return

    setInputValue('')
    sendMutation.mutate({ content })
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

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
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">AI 코디네이팅 룸</h1>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="py-3">
          <p className="text-xs text-muted-foreground">
            메인 에이전트(김주영)에게 오늘 일정 조율이나 전략을 직접 요청해 보세요.
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
          <div
            ref={scroll_ref}
            className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3"
          >
            {isPending ? (
              <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 대화가 없습니다. 아래 입력창에 예를 들어 &quot;오늘 일정이 너무 많아요&quot;
                처럼 입력해 보세요.
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
              placeholder="메인 에이전트에게 문의할 내용을 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
            />
            <div className="flex justify-end">
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

export { AiDashboardPage }
