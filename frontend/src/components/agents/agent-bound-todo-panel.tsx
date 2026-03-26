import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'

interface AgentBoundTodoPanelPropsInterface {
  roleType: 'MAIN' | 'SUB'
  fixedSchedules: ScheduleOccurrenceInterface[]
  calendarEvents: ScheduleOccurrenceInterface[]
  boundTodos: ScheduleOccurrenceInterface[]
  isPending: boolean
}

const formatTime = (iso: string) => {
  if (!iso || iso.length < 16) return iso
  return iso.slice(11, 16)
}

export const AgentBoundTodoPanel = ({
  roleType,
  fixedSchedules,
  calendarEvents,
  boundTodos,
  isPending,
}: AgentBoundTodoPanelPropsInterface) => {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <h3 className="text-sm font-semibold">바인딩 일정 보기</h3>
        <p className="text-[11px] text-muted-foreground">
          {roleType === 'MAIN'
            ? '메인: 정기일정/일정 + 자신 및 소속 서브 TODO'
            : '서브: 정기일정/일정 + 자신에게 바인딩된 TODO'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <p className="text-xs text-muted-foreground">일정을 불러오는 중입니다...</p>
        ) : null}

        <div className="space-y-1">
          <p className="text-xs font-semibold">정기일정</p>
          {fixedSchedules.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">등록된 정기일정이 없습니다.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-auto">
              {fixedSchedules.map((item) => (
                <div key={`fixed-${item.id}`} className="rounded border p-2">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.occurrenceDate} {formatTime(item.startAt)}-{formatTime(item.endAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold">일정</p>
          {calendarEvents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">등록된 일정이 없습니다.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-auto">
              {calendarEvents.map((item) => (
                <div key={`event-${item.id}`} className="rounded border p-2">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.occurrenceDate} {formatTime(item.startAt)}-{formatTime(item.endAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold">바인딩 TODO</p>
          {boundTodos.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">표시할 TODO가 없습니다.</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-auto">
              {boundTodos.map((item) => (
                <div key={`todo-${item.id}`} className="rounded border p-2">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.occurrenceDate} {formatTime(item.startAt)}-{formatTime(item.endAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
