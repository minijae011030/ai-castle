import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useMainChatHistory, useSendMainChatMessage } from '@/hooks/queries/chat-query'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useEffect, useRef, useState } from 'react'

const AiDashboardPage = () => {
  const { data: messages = [], isPending } = useMainChatHistory()
  const send_mutation = useSendMainChatMessage()

  const [input_value, set_input_value] = useState('')
  const scroll_ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!scroll_ref.current) return
    scroll_ref.current.scrollTop = scroll_ref.current.scrollHeight
  }, [messages.length])

  const handle_send = () => {
    const content = input_value.trim()
    if (!content || send_mutation.isPending) return

    set_input_value('')
    send_mutation.mutate({ content })
  }

  const handle_key_down: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handle_send()
    }
  }

  const render_message = (message: ChatMessageInterface) => {
    const is_user = message.role === 'USER'
    const is_assistant = message.role === 'ASSISTANT'

    return (
      <div key={message.id} className={`flex w-full ${is_user ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[70%] rounded-lg px-3 py-2 text-xs ${
            is_user
              ? 'bg-primary text-primary-foreground'
              : is_assistant
                ? 'bg-muted text-foreground'
                : 'bg-secondary text-secondary-foreground'
          }`}
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
              messages.map(render_message)
            )}
          </div>

          <div className="space-y-2">
            <Textarea
              value={input_value}
              onChange={(event) => set_input_value(event.target.value)}
              onKeyDown={handle_key_down}
              rows={3}
              placeholder="메인 에이전트에게 문의할 내용을 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handle_send}
                disabled={!input_value.trim() || send_mutation.isPending}
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
