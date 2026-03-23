import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  const [expandedMainMap, setExpandedMainMap] = useState<Record<number, boolean>>({})

  const { mainAgents, unlinkedSubAgents, subAgentsByMainId } = useMemo(() => {
    const mains = agents.filter((agent) => agent.roleType === 'MAIN')
    const subByMainId: Record<number, AgentRoleDataInterface[]> = {}
    const unlinkedSubs: AgentRoleDataInterface[] = []

    for (const agent of agents) {
      if (agent.roleType !== 'SUB') continue
      if (!agent.mainAgentId) {
        unlinkedSubs.push(agent)
        continue
      }
      if (!subByMainId[agent.mainAgentId]) {
        subByMainId[agent.mainAgentId] = []
      }
      subByMainId[agent.mainAgentId].push(agent)
    }

    return { mainAgents: mains, unlinkedSubAgents: unlinkedSubs, subAgentsByMainId: subByMainId }
  }, [agents])

  const renderAgentRow = (agent: AgentRoleDataInterface, isSub: boolean) => {
    const isActive = effectiveSelectedAgentId === agent.id
    return (
      <li key={agent.id}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 p-2 text-left text-sm',
            isSub ? 'pl-9' : 'pl-3',
            isActive ? 'bg-primary/10' : 'bg-background hover:bg-muted/60',
          )}
          onClick={() => onOpenChat(agent)}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isSub ? 'bg-muted-foreground/60' : 'bg-primary/70',
            )}
          />
          <span className="truncate">{agent.name}</span>
        </button>
      </li>
    )
  }

  const handleToggleMainFolder = (mainAgentId: number) => {
    setExpandedMainMap((previous) => ({
      ...previous,
      [mainAgentId]: previous[mainAgentId] === undefined ? false : !previous[mainAgentId],
    }))
  }

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
          <ul className="py-1">
            {mainAgents.map((mainAgent) => {
              const subAgents = subAgentsByMainId[mainAgent.id] ?? []
              const isExpanded = expandedMainMap[mainAgent.id] ?? true
              const isMainActive = effectiveSelectedAgentId === mainAgent.id

              return (
                <li key={mainAgent.id} className="border-b last:border-b-0">
                  <div className={cn('px-1 py-1', isMainActive ? 'bg-primary/5' : '')}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      onClick={() => handleToggleMainFolder(mainAgent.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                        <span className="truncate font-medium">{mainAgent.name}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        SUB {subAgents.length}
                      </span>
                    </button>
                    {isExpanded ? (
                      <ul className="pt-1">
                        {renderAgentRow(mainAgent, false)}
                        {subAgents.map((subAgent) => renderAgentRow(subAgent, true))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              )
            })}

            {unlinkedSubAgents.length > 0 ? (
              <li className="border-t">
                <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  미연결 서브
                </div>
                <ul className="pb-1">
                  {unlinkedSubAgents.map((subAgent) => renderAgentRow(subAgent, true))}
                </ul>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  )
}
