import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useAgentRoleList,
  useCreateAgentRole,
  useUpdateAgentRole,
} from '@/hooks/queries/agent-query'
import { useAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useEffect, useRef, useState } from 'react'

const empty_form = {
  name: '',
  role_type: 'SUB' as 'MAIN' | 'SUB',
  system_prompt: '',
}

const AgentListPage = () => {
  const { data: agents = [], isPending } = useAgentRoleList()
  const create_mutation = useCreateAgentRole()
  const update_mutation = useUpdateAgentRole()

  const [selected_agent_id, set_selected_agent_id] = useState<number | null>(null)
  const [form, set_form] = useState(empty_form)
  const [chat_agent_id, set_chat_agent_id] = useState<number | null>(null)
  const [chat_input, set_chat_input] = useState('')

  const { data: chat_messages = [], isPending: is_chat_pending } = useAgentChatHistory(
    chat_agent_id ?? 0,
    {
      enabled: chat_agent_id !== null,
    },
  )
  const send_chat_mutation = useSendAgentChatMessage(chat_agent_id ?? 0, {
    onSuccess: () => {
      set_chat_input('')
    },
  })

  const chat_scroll_ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chat_scroll_ref.current) return
    chat_scroll_ref.current.scrollTop = chat_scroll_ref.current.scrollHeight
  }, [chat_messages.length])

  const handle_change_new = () => {
    set_selected_agent_id(null)
    set_form(empty_form)
    set_chat_agent_id(null)
  }

  const handle_submit = async () => {
    const name = form.name.trim()
    const system_prompt = form.system_prompt.trim()
    if (!name || !system_prompt) return

    if (selected_agent_id === null) {
      await create_mutation.mutateAsync({
        name,
        roleType: form.role_type,
        systemPrompt: system_prompt,
      })
      set_form(empty_form)
    } else {
      await update_mutation.mutateAsync({
        id: selected_agent_id,
        body: {
          systemPrompt: system_prompt,
        },
      })
    }
  }

  const is_submitting = create_mutation.isPending || update_mutation.isPending

  const handle_select_agent_for_settings = (agent: AgentRoleDataInterface) => {
    set_chat_agent_id(null)
    set_selected_agent_id(agent.id)
    set_form({
      name: agent.name,
      role_type: agent.roleType,
      system_prompt: agent.systemPrompt,
    })
  }

  const handle_open_chat = (agent: AgentRoleDataInterface) => {
    set_chat_agent_id(agent.id)
    set_selected_agent_id(agent.id)
    set_form({
      name: agent.name,
      role_type: agent.roleType,
      system_prompt: agent.systemPrompt,
    })
  }

  const handle_send_chat = () => {
    if (chat_agent_id === null) return
    const content = chat_input.trim()
    if (!content || send_chat_mutation.isPending) return
    send_chat_mutation.mutate({ content })
  }

  const handle_chat_key_down: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handle_send_chat()
    }
  }

  const render_chat_message = (message: ChatMessageInterface) => {
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
    <div className="flex h-full gap-4">
      <div className="flex w-72 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">에이전트 목록</h2>
          <Button size="xs" variant="outline" onClick={handle_change_new}>
            + 새 에이전트
          </Button>
        </div>
        <div className="flex-1 overflow-auto rounded border bg-card">
          {isPending ? (
            <p className="p-3 text-xs text-muted-foreground">에이전트를 불러오는 중입니다...</p>
          ) : agents.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              등록된 에이전트가 없습니다. 우측에서 새 에이전트를 추가해 보세요.
            </p>
          ) : (
            <ul className="divide-y">
              {agents.map((agent) => {
                const is_active = selected_agent_id === agent.id
                return (
                  <li key={agent.id}>
                    <div
                      className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                        is_active ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handle_open_chat(agent)}
                        className="flex flex-1 flex-col items-start gap-1 text-left"
                      >
                        <span className="font-medium text-foreground">{agent.name}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {agent.roleType === 'MAIN' ? 'MAIN' : 'SUB'}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => handle_select_agent_for_settings(agent)}
                      >
                        설정
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1">
        {chat_agent_id === null ? (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <h2 className="text-sm font-semibold">
                {selected_agent_id === null ? '새 에이전트 추가' : '에이전트 설정'}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-name">에이전트 이름</Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={(e) => set_form((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 코테 과외쌤"
                  disabled={selected_agent_id !== null}
                />
              </div>
              <div className="grid gap-2">
                <Label>에이전트 타입</Label>
                <div className="flex gap-2 text-xs">
                  <Button
                    type="button"
                    size="xs"
                    variant={form.role_type === 'MAIN' ? 'default' : 'outline'}
                    onClick={() => set_form((prev) => ({ ...prev, role_type: 'MAIN' }))}
                    disabled={selected_agent_id !== null}
                  >
                    메인 에이전트
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={form.role_type === 'SUB' ? 'default' : 'outline'}
                    onClick={() => set_form((prev) => ({ ...prev, role_type: 'SUB' }))}
                    disabled={selected_agent_id !== null}
                  >
                    서브 에이전트
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agent-system-prompt">시스템 프롬프트</Label>
                <Textarea
                  id="agent-system-prompt"
                  value={form.system_prompt}
                  onChange={(e) => set_form((prev) => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="이 에이전트가 어떤 역할/말투/전략으로 답할지 작성해 주세요."
                  rows={10}
                />
                <p className="text-[11px] text-muted-foreground">
                  예: &quot;너는 코딩 테스트 과외 선생님이다. 항상 단계별 풀이와 시간 복잡도를
                  설명한다.&quot;
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handle_submit} disabled={is_submitting}>
                  {selected_agent_id === null ? '에이전트 생성' : '프롬프트 저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {agents.find((a) => a.id === chat_agent_id)?.name ?? '에이전트 대화'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  선택한 에이전트와 개별적으로 대화할 수 있습니다.
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  const target = agents.find((a) => a.id === chat_agent_id) ?? null
                  if (target) {
                    handle_select_agent_for_settings(target)
                  } else {
                    set_chat_agent_id(null)
                  }
                }}
              >
                에이전트 설정
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
              <div
                ref={chat_scroll_ref}
                className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3"
              >
                {is_chat_pending ? (
                  <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
                ) : chat_messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
                  </p>
                ) : (
                  chat_messages.map(render_chat_message)
                )}
              </div>
              <div className="space-y-2">
                <Textarea
                  value={chat_input}
                  onChange={(event) => set_chat_input(event.target.value)}
                  onKeyDown={handle_chat_key_down}
                  rows={3}
                  placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handle_send_chat}
                    disabled={!chat_input.trim() || send_chat_mutation.isPending}
                  >
                    보내기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export { AgentListPage }
