import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScheduleDayListPanel } from '@/components/calendar/schedule-day-list-panel'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'

interface AgentBoundTodoPanelPropsInterface {
  fixedSchedules: ScheduleOccurrenceInterface[]
  calendarEvents: ScheduleOccurrenceInterface[]
  boundTodos: ScheduleOccurrenceInterface[]
  isPending: boolean
  onToggleDone: (schedule: ScheduleOccurrenceInterface) => void
}

export const AgentBoundTodoPanel = ({
  fixedSchedules,
  calendarEvents,
  boundTodos,
  isPending,
  onToggleDone,
}: AgentBoundTodoPanelPropsInterface) => {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  const todaySchedules = [...fixedSchedules, ...calendarEvents, ...boundTodos]
    .filter((item) => item.occurrenceDate === today)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <h3 className="text-sm font-semibold">오늘 날짜 일정</h3>
        <p className="text-[11px] text-muted-foreground">{today.replaceAll('-', '.')} 기준</p>
      </CardHeader>
      <CardContent>
        <ScheduleDayListPanel
          schedules={todaySchedules}
          isPending={isPending}
          emptyText="오늘 일정이 없습니다."
          maxHeightClassName="max-h-[320px]"
          onToggleDone={onToggleDone}
        />
      </CardContent>
    </Card>
  )
}
