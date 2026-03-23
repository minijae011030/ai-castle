import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgentRoleDataInterface } from '@/types/agent.type'

interface AgentListPanelPropsInterface {
  isPending: boolean
  agents: AgentRoleDataInterface[]
  effectiveSelectedAgentId: number | null
  onCreateNew: () => void
  onOpenChat: (agent: AgentRoleDataInterface) => void
}

export const AgentListPanel = ({
  isPending,
  agents,
  effectiveSelectedAgentId,
  onCreateNew,
  onOpenChat,
}: AgentListPanelPropsInterface) => {
  return (
    <div className="flex w-72 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">에이전트 목록</h2>
        <Button size="xs" variant="outline" onClick={onCreateNew}>
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
              const is_active = effectiveSelectedAgentId === agent.id
              return (
                <li key={agent.id}>
                  <div
                    className={cn(
                      'flex flex-1 items-start justify-between gap-1 p-3 text-left text-sm',
                      is_active ? 'bg-primary/10' : 'bg-background',
                    )}
                    onClick={() => onOpenChat(agent)}
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
  )
}
