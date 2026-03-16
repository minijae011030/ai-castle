import type { TodoItemInterface } from '@/types/todo.type'

interface TodayTodoSectionPropsInterface {
  todos: TodoItemInterface[]
}

const TodayTodoSection = ({ todos }: TodayTodoSectionPropsInterface) => {
  const todos_by_agent = todos.reduce<Record<number, TodoItemInterface[]>>((acc, todo) => {
    const agent_id = todo.agent.id
    if (!acc[agent_id]) acc[agent_id] = []
    acc[agent_id].push(todo)
    return acc
  }, {})

  const agent_ids = Object.keys(todos_by_agent).map((id) => Number(id))

  if (agent_ids.length === 0) {
    // 해당 날짜에 할 일이 없으면 아무것도 렌더링하지 않음
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
                    <div className="flex-1 truncate">
                      <p className="text-xs font-medium text-foreground">{todo.title}</p>
                      {todo.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {todo.description}
                        </p>
                      )}
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

export { TodayTodoSection }
