import { Button } from '@/components/ui/button'
import type { TodoItemInterface } from '@/types/todo.type'
import { CheckCircle2Icon, CircleIcon } from 'lucide-react'

interface TodayTodoSectionPropsInterface {
  todos: TodoItemInterface[]
  is_pending: boolean
  /** Todo 완료 토글 클릭 시 호출되는 콜백 (서버 반영 포함) */
  on_toggle_completed: (todo: TodoItemInterface) => void
}

export const TodayTodoSection = ({
  todos,
  is_pending,
  on_toggle_completed,
}: TodayTodoSectionPropsInterface) => {
  const todos_by_agent = todos.reduce<Record<number, TodoItemInterface[]>>((acc, todo) => {
    const agent_id = todo.agent.id
    if (!acc[agent_id]) acc[agent_id] = []
    acc[agent_id].push(todo)
    return acc
  }, {})

  const agent_ids = Object.keys(todos_by_agent).map((id) => Number(id))

  if (is_pending || agent_ids.length === 0) {
    // 로딩 중이거나 할 일이 없으면 아무것도 렌더링하지 않음
    return null
  }

  return (
    <div className="space-y-2 text-xs">
      {agent_ids.map((agent_id) => {
        const group = todos_by_agent[agent_id]
        const agent_name = group[0]?.agent.name ?? '에이전트'
        return (
          <div key={agent_id} className="space-y-1.5">
            <p className="font-semibold text-foreground">{agent_name}</p>
            <ul className="space-y-1">
              {group.map((todo) => (
                <li key={todo.id}>
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Todo 완료 토글"
                        onClick={() => on_toggle_completed(todo)}
                      >
                        {todo.status === 'DONE' ? (
                          <CheckCircle2Icon className="size-4 text-primary" />
                        ) : (
                          <CircleIcon className="size-4 text-muted-foreground" />
                        )}
                      </Button>
                      <div className="flex-1 truncate">
                        <p
                          className={`text-xs font-medium ${
                            todo.status === 'DONE'
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          }`}
                        >
                          {todo.title}
                        </p>
                        {todo.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {todo.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {todo.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
