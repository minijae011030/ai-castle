import { Card, CardContent } from '@/components/ui/card'
import { format_date_time } from '@/lib/format'
import type { CalendarEventInterface } from '@/types/calendar.type'
import type { RecurringScheduleDataInterface } from '@/types/recurring-schedule.type'
import type { TodoItemInterface } from '@/types/todo.type'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface TodaySummarySectionPropsInterface {
  selected_date: Date
  events_on_selected: CalendarEventInterface[]
  is_event_pending: boolean
  recurring_schedules: RecurringScheduleDataInterface[]
  todos: TodoItemInterface[]
}

const TodaySummarySection = ({
  selected_date,
  events_on_selected,
  is_event_pending,
  recurring_schedules,
  todos,
}: TodaySummarySectionPropsInterface) => {
  const date_label = format(selected_date, 'yyyy년 M월 d일 (EEE)', { locale: ko })

  const recurring_for_today = recurring_schedules // TODO: 정기 일정에서 오늘에 해당하는 것만 필터링

  const todos_by_agent = todos.reduce<Record<number, TodoItemInterface[]>>((acc, todo) => {
    const agent_id = todo.agent.id
    if (!acc[agent_id]) acc[agent_id] = []
    acc[agent_id].push(todo)
    return acc
  }, {})

  const agent_ids = Object.keys(todos_by_agent).map((id) => Number(id))
  const has_recurring = recurring_for_today.length > 0
  const has_events = events_on_selected.length > 0
  const has_todos = agent_ids.length > 0
  const has_any_data = has_recurring || has_events || has_todos

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{date_label}</h2>
      </div>

      {/* 정기 일정 목록 (데이터가 있을 때만 렌더링) */}
      {has_recurring && (
        <div className="space-y-1">
          <p className="font-semibold">정기 일정 목록</p>
          <CardContent className="space-y-1 px-0 py-0 text-xs">
            {recurring_for_today.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {item.startTime.slice(0, 5)} ~ {item.endTime.slice(0, 5)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </div>
      )}

      {/* 일정 목록 (로딩 중이면 띄우고, 데이터 있을 때만 렌더링) */}
      {is_event_pending
        ? null
        : has_events && (
            <div className="space-y-1">
              <p className="font-semibold">일정 목록</p>
              <CardContent className="space-y-1 px-0 py-0 text-xs">
                {events_on_selected.map((event) => (
                  <div key={event.id} className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{event.title}</span>
                    <span className="text-muted-foreground">
                      {format_date_time(event.startAt)} ~ {format_date_time(event.endAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </div>
          )}

      {/* 할 일 목록 (데이터가 있을 때만 렌더링) */}
      {has_todos && (
        <div className="space-y-1">
          <p className="font-semibold">할 일 목록</p>
          <CardContent className="space-y-3 px-0 py-0 text-xs">
            {agent_ids.map((agent_id) => {
              const group = todos_by_agent[agent_id]
              const agent_name = group[0]?.agent.name ?? '에이전트'
              return (
                <div key={agent_id} className="space-y-1.5">
                  <p className="font-semibold text-foreground">{agent_name}</p>
                  <ul className="space-y-1">
                    {group.map((todo) => (
                      <li key={todo.id}>
                        <Card className="border bg-card">
                          <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
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
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </CardContent>
        </div>
      )}

      {/* 세 가지가 모두 비었을 때만 전체 안내 문구 출력 */}
      {!is_event_pending && !has_any_data && (
        <p className="text-xs text-muted-foreground">
          해당 날짜에는 정기 일정, 단일 일정, 할 일이 없습니다.
        </p>
      )}
    </div>
  )
}

export { TodaySummarySection }
