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
import { cn } from '@/lib/utils'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import type { ChatMessageInterface } from '@/types/chat.type'
import { useEffect, useRef, useState } from 'react'
import { MarkdownMessage } from '@/components/chat/markdown-message'

const emptyForm = {
  name: '',
  roleType: 'SUB' as 'MAIN' | 'SUB',
  systemPrompt: '',
}

export const AgentListPage = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [chatAgentId, setChatAgentId] = useState<number | null>(null)
  const [chatInput, setChatInput] = useState('')

  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const sendLockRef = useRef(false)
  const lastSentContentRef = useRef<string | null>(null)

  const { data: agents = [], isPending } = useAgentRoleList()
  const { data: chatMessages = [], isPending: isChatPending } = useAgentChatHistory(
    chatAgentId ?? 0,
  )

  const createMutation = useCreateAgentRole()
  const updateMutation = useUpdateAgentRole()
  const sendChatMutation = useSendAgentChatMessage(chatAgentId ?? 0, {
    onSettled: () => {
      sendLockRef.current = false
    },
    onError: () => {
      // 전송 실패 시, 사용자가 입력한 내용을 복구 (이미 다른 입력을 시작했다면 방해하지 않음)
      if (!chatInput.trim() && lastSentContentRef.current) {
        setChatInput(lastSentContentRef.current)
      }
      lastSentContentRef.current = null
    },
    onSuccess: () => {
      lastSentContentRef.current = null
    },
  })

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatMessages.length])

  // 새 에이전트 추가 버튼 클릭 핸들러
  const handleChangeNew = () => {
    setSelectedAgentId(null)
    setForm(emptyForm)
    setChatAgentId(null)
  }

  // 에이전트 저장 버튼 클릭 핸들러
  const handleSubmit = async () => {
    const name = form.name.trim()
    const systemPrompt = form.systemPrompt.trim()
    if (!name || !systemPrompt) return

    if (selectedAgentId === null) {
      await createMutation.mutateAsync({
        name,
        roleType: form.roleType,
        systemPrompt: systemPrompt,
      })
      setForm(emptyForm)
    } else {
      await updateMutation.mutateAsync({
        id: selectedAgentId,
        body: {
          systemPrompt: systemPrompt,
        },
      })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  // 에이전트 설정 버튼 클릭 핸들러
  const handleSelectAgentForSettings = (agent: AgentRoleDataInterface) => {
    setChatAgentId(null)
    setSelectedAgentId(agent.id)
    setForm({
      name: agent.name,
      roleType: agent.roleType,
      systemPrompt: agent.systemPrompt,
    })
  }

  // 채팅 창 열기 버튼 클릭 핸들러
  const handleOpenChat = (agent: AgentRoleDataInterface) => {
    setChatAgentId(agent.id)
    setSelectedAgentId(agent.id)
    setForm({
      name: agent.name,
      roleType: agent.roleType,
      systemPrompt: agent.systemPrompt,
    })
  }

  // 채팅 전송 버튼 클릭 핸들러
  const handleSendChat = () => {
    if (chatAgentId === null) return
    const content = chatInput.trim()
    if (!content || sendChatMutation.isPending || sendLockRef.current) return
    sendLockRef.current = true
    lastSentContentRef.current = content
    setChatInput('') // 엔터/전송 즉시 입력창 비우기
    sendChatMutation.mutate({ content })
  }

  // 채팅 입력창 엔터키 누르면 전송 핸들러
  const handleChatKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    // 한글 입력(IME) 조합 중 Enter는 전송으로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendChat()
    }
  }

  // 채팅 메시지 렌더링 핸들러
  const renderChatMessage = (message: ChatMessageInterface) => {
    const is_user = message.role === 'USER'
    const is_assistant = message.role === 'ASSISTANT'

    return (
      <div
        key={message.id}
        className={cn('flex w-full', is_user ? 'justify-end' : 'justify-start')}
      >
        <div
          className={cn(
            'max-w-[70%] rounded-lg px-3 py-2 text-xs',
            is_user
              ? 'bg-primary text-primary-foreground'
              : is_assistant
                ? 'bg-muted text-foreground'
                : 'bg-secondary text-secondary-foreground',
          )}
        >
          {is_user ? (
            <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
          ) : (
            <MarkdownMessage content={message.content} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      <div className="flex w-72 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">에이전트 목록</h2>
          <Button size="xs" variant="outline" onClick={handleChangeNew}>
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
                const is_active = selectedAgentId === agent.id
                return (
                  <li key={agent.id}>
                    <div
                      className={cn(
                        'flex flex-1 justify-between p-3 items-start gap-1 text-left text-sm',
                        is_active ? 'bg-primary/10' : 'bg-background',
                      )}
                      onClick={() => handleOpenChat(agent)}
                    >
                      {agent.name}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1">
        {chatAgentId === null ? (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <h2 className="text-sm font-semibold">
                {selectedAgentId === null ? '새 에이전트 추가' : '에이전트 설정'}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-name">에이전트 이름</Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 코테 과외쌤"
                  disabled={selectedAgentId !== null}
                />
              </div>
              <div className="grid gap-2">
                <Label>에이전트 타입</Label>
                <div className="flex gap-2 text-xs">
                  <Button
                    type="button"
                    size="xs"
                    variant={form.roleType === 'MAIN' ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, roleType: 'MAIN' }))}
                    disabled={selectedAgentId !== null}
                  >
                    메인 에이전트
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={form.roleType === 'SUB' ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, roleType: 'SUB' }))}
                    disabled={selectedAgentId !== null}
                  >
                    서브 에이전트
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agent-system-prompt">시스템 프롬프트</Label>
                <Textarea
                  id="agent-system-prompt"
                  value={form.systemPrompt}
                  onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="이 에이전트가 어떤 역할/말투/전략으로 답할지 작성해 주세요."
                  rows={10}
                />
                <p className="text-[11px] text-muted-foreground">
                  예: &quot;너는 코딩 테스트 과외 선생님이다. 항상 단계별 풀이와 시간 복잡도를
                  설명한다.&quot;
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                  {selectedAgentId === null ? '에이전트 생성' : '프롬프트 저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {agents.find((a) => a.id === chatAgentId)?.name ?? '에이전트 대화'}
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
                  const target = agents.find((a) => a.id === chatAgentId) ?? null
                  if (target) {
                    handleSelectAgentForSettings(target)
                  } else {
                    setChatAgentId(null)
                  }
                }}
              >
                에이전트 설정
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
              <div
                ref={chatScrollRef}
                className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3 max-h-[min(1000px,calc(100dvh-320px))]"
              >
                {isChatPending ? (
                  <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
                ) : chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
                  </p>
                ) : (
                  chatMessages.map(renderChatMessage)
                )}
              </div>
              <div className="space-y-2">
                <Textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={handleChatKeyDown}
                  rows={3}
                  placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || sendChatMutation.isPending}
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
