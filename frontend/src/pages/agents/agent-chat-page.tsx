import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { useAgentRoleList } from '@/hooks/queries/agent-query'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useParams, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

const AgentChatPage = () => {
  const params = useParams({ from: '/agents/$agentId/chat' })
  const agent_id = Number(params.agentId)

  const { data: agents = [] } = useAgentRoleList()
  const agent = useMemo(() => agents.find((a) => a.id === agent_id) ?? null, [agents, agent_id])

  const { data: messages = [], isPending } = useAgentChatHistory(agent_id)
  const send_mutation = useSendAgentChatMessage(agent_id)

  const [input_value, set_input_value] = useState('')
  const scroll_ref = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!agent_id || Number.isNaN(agent_id)) {
      router.navigate({ to: '/agents' })
    }
  }, [agent_id, router])

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
            ref={scroll_ref}
            className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3"
          >
            {isPending ? (
              <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
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
              placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
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

export { AgentChatPage }
