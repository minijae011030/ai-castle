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
import type { AgentRoleDataInterface } from '@/types/agent.type'
import { useState } from 'react'

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

  const handle_select_agent = (agent: AgentRoleDataInterface) => {
    set_selected_agent_id(agent.id)
    set_form({
      name: agent.name,
      role_type: agent.roleType,
      system_prompt: agent.systemPrompt,
    })
  }

  const handle_change_new = () => {
    set_selected_agent_id(null)
    set_form(empty_form)
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
                    <button
                      type="button"
                      onClick={() => handle_select_agent(agent)}
                      className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-xs ${
                        is_active ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="font-medium text-foreground">{agent.name}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {agent.roleType === 'MAIN' ? 'MAIN' : 'SUB'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1">
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
      </div>
    </div>
  )
}

export { AgentListPage }
