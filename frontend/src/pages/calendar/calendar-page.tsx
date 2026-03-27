import { ko } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import {
  useSchedulesByDay,
  useSchedulesByMonth,
  useToggleScheduleDone,
  useToggleRecurringScheduleDone,
  useRunTodoAgent,
} from '@/hooks/queries/schedule-query'
import { format } from 'date-fns'
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell'
import { ScheduleDayListPanel } from '@/components/calendar/schedule-day-list-panel'
import { ScheduleCreateDialog } from '@/components/calendar/schedule-create-dialog'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import { Badge } from '@/components/ui/badge'
import { useRecurringScheduleTemplateList } from '@/hooks/queries/recurring-schedule-template-query'
import type { RecurringScheduleTemplateInterface } from '@/types/recurring-schedule-template.type'
import { Button } from '@/components/ui/button'
import { useActiveAgentList } from '@/hooks/queries/agent-query'
import type { ChatMessageInterface } from '@/types/chat.type'
import { TodoMessage } from '@/components/chat/todo-message'

export const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailTargetKey, setDetailTargetKey] = useState<string | null>(null)
  const [todoAgentResult, setTodoAgentResult] = useState<ChatMessageInterface | null>(null)

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data: schedulesByDay, isPending } = useSchedulesByDay(selectedDateStr)

  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth() + 1
  const { data: schedulesByMonth } = useSchedulesByMonth(year, month)

  const { data: recurringTemplates = [] } = useRecurringScheduleTemplateList()
  const { data: activeAgents = [] } = useActiveAgentList()

  const schedulesFromTemplates: ScheduleOccurrenceInterface[] = useMemo(() => {
    if (!recurringTemplates) return []

    const result: ScheduleOccurrenceInterface[] = []
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)

    const weekdayByIndex: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    for (const t of recurringTemplates as RecurringScheduleTemplateInterface[]) {
      const periodStart = new Date(t.periodStartDate)
      const periodEnd = new Date(t.periodEndDate)

      const iterStart = startOfMonth < periodStart ? periodStart : startOfMonth
      const iterEnd = endOfMonth > periodEnd ? periodEnd : endOfMonth

      for (let d = new Date(iterStart.getTime()); d <= iterEnd; d.setDate(d.getDate() + 1)) {
        const weekdayCode = weekdayByIndex[d.getDay()]
        const tokens = t.repeatWeekdays
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

        if (!tokens.includes(weekdayCode)) continue

        const dateStr = format(d, 'yyyy-MM-dd')

        result.push({
          id: Number(`${t.id}${format(d, 'dd')}`),
          title: t.title,
          category: t.category,
          description: t.description,
          done: false,
          type: 'RECURRING_OCCURRENCE',
          occurrenceDate: dateStr,
          startAt: `${dateStr}T${t.startTime}`,
          endAt: `${dateStr}T${t.endTime}`,
          recurringTemplateId: t.id,
          agentId: null,
          groupId: null,
          groupTitle: null,
        })
      }
    }

    return result
  }, [month, recurringTemplates, year])

  const templatesByDateMap = useMemo(() => {
    const map: Record<string, ScheduleOccurrenceInterface[]> = {}
    for (const s of schedulesFromTemplates) {
      const key = s.occurrenceDate
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [schedulesFromTemplates])

  const schedulesByDateMap = useMemo(() => {
    const map: Record<string, ScheduleOccurrenceInterface[]> = {}

    const existingRecurringKeys = new Set(
      (schedulesByMonth ?? [])
        .filter(
          (s) =>
            s.type === 'RECURRING_OCCURRENCE' && s.recurringTemplateId !== null && s.occurrenceDate,
        )
        .map((s) => `${s.recurringTemplateId}-${s.occurrenceDate}`),
    )

    const all: ScheduleOccurrenceInterface[] = [...(schedulesByMonth ?? [])]

    for (const s of schedulesFromTemplates) {
      const key = `${s.recurringTemplateId}-${s.occurrenceDate}`
      if (s.recurringTemplateId && !existingRecurringKeys.has(key)) {
        all.push(s)
      }
    }

    for (const s of all) {
      const dateKey = s.occurrenceDate
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(s)
    }

    return map
  }, [schedulesByMonth, schedulesFromTemplates])

  const existingCategoryOptions = useMemo(() => {
    const categorySet = new Set<string>()
    for (const schedule of schedulesByMonth ?? []) {
      const normalizedCategory = schedule.category?.trim()
      if (normalizedCategory) categorySet.add(normalizedCategory)
    }
    for (const template of recurringTemplates as RecurringScheduleTemplateInterface[]) {
      const normalizedCategory = template.category?.trim()
      if (normalizedCategory) categorySet.add(normalizedCategory)
    }
    return [...categorySet].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [recurringTemplates, schedulesByMonth])

  const schedulesForSelectedDay = useMemo(() => {
    const fromApi = schedulesByDay ?? []
    const fromTemplates = templatesByDateMap[selectedDateStr] ?? []

    const existingRecurringKeys = new Set(
      fromApi
        .filter(
          (s) =>
            s.type === 'RECURRING_OCCURRENCE' &&
            s.recurringTemplateId !== null &&
            s.occurrenceDate === selectedDateStr,
        )
        .map((s) => `${s.recurringTemplateId}-${s.occurrenceDate}`),
    )

    const filteredTemplates = fromTemplates.filter((s) => {
      if (!s.recurringTemplateId) return true
      const key = `${s.recurringTemplateId}-${s.occurrenceDate}`
      return !existingRecurringKeys.has(key)
    })

    return [...fromApi, ...filteredTemplates].sort((a, b) => a.startAt.localeCompare(b.startAt))
  }, [schedulesByDay, selectedDateStr, templatesByDateMap])

  const toggleScheduleDoneMutation = useToggleScheduleDone()
  const toggleRecurringDoneMutation = useToggleRecurringScheduleDone()
  const runTodoAgentMutation = useRunTodoAgent({
    onSuccess: (msg) => setTodoAgentResult(msg),
  })

  const detailTarget = useMemo(() => {
    if (!detailTargetKey) return null
    return schedulesForSelectedDay.find(
      (s) => `${s.type}-${s.recurringTemplateId ?? s.id}` === detailTargetKey,
    )
  }, [detailTargetKey, schedulesForSelectedDay])

  const agentNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const a of activeAgents) {
      map.set(a.id, a.name)
    }
    return map
  }, [activeAgents])

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-2xl shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          month={visibleMonth}
          onMonthChange={(nextMonth) => {
            setVisibleMonth(nextMonth)
            // 월 이동 시 선택 날짜를 해당 월 1일로 맞춰, 우측 상세/등록 기준 날짜도 함께 이동시킨다.
            setSelectedDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
            setDetailTargetKey(null)
            setTodoAgentResult(null)
          }}
          onSelect={(d) => {
            if (!d) return
            setSelectedDate(d)
            setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1))
          }}
          locale={ko}
          className="[--cell-size:6rem]"
          classNames={{
            table: 'table-fixed w-full',
            day: 'min-h-[5rem] min-w-[var(--cell-size)] w-[var(--cell-size)] max-w-[var(--cell-size)] aspect-auto align-top',
          }}
          components={{
            DayButton: (props) => (
              <CalendarDayCell
                schedules={schedulesByDateMap[format(props.day.date, 'yyyy-MM-dd')] ?? []}
                {...props}
              />
            ),
          }}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </h2>
          <ScheduleCreateDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            selectedDateStr={selectedDateStr}
            existingCategories={existingCategoryOptions}
            trigger={
              <Button size="sm" variant="outline">
                + 추가
              </Button>
            }
          />
        </div>
        <ScheduleDayListPanel
          schedules={schedulesForSelectedDay}
          isPending={isPending}
          selectedKey={detailTargetKey}
          onSelect={(key) => {
            setDetailTargetKey(key)
            setTodoAgentResult(null)
          }}
          onToggleDone={(schedule) => {
            const isRecurring =
              schedule.type === 'RECURRING_OCCURRENCE' && schedule.recurringTemplateId !== null
            if (isRecurring && schedule.recurringTemplateId) {
              toggleRecurringDoneMutation.mutate({
                templateId: schedule.recurringTemplateId,
                date: schedule.occurrenceDate,
              })
              return
            }
            toggleScheduleDoneMutation.mutate({ id: schedule.id })
          }}
        />
        {detailTarget && (
          <div className="mt-2 rounded-md border bg-card p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{detailTarget.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  카테고리: {detailTarget.category?.trim() ? detailTarget.category : '미지정'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {format(new Date(detailTarget.startAt), 'HH:mm')} ~{' '}
                  {format(new Date(detailTarget.endAt), 'HH:mm')}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                {detailTarget.type === 'RECURRING_OCCURRENCE'
                  ? '정기'
                  : detailTarget.type === 'CALENDAR_EVENT'
                    ? '일정'
                    : '할 일'}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">설명</p>
                <p className="whitespace-pre-wrap">
                  {detailTarget.description?.trim() ? detailTarget.description : '설명 없음'}
                </p>
              </div>

              {detailTarget.type === 'TODO' && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">에이전트</p>
                  <p>
                    {detailTarget.agentId
                      ? (agentNameById.get(detailTarget.agentId) ?? `#${detailTarget.agentId}`)
                      : '미지정'}
                  </p>
                </div>
              )}
            </div>

            {detailTarget.type === 'TODO' && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!detailTarget.agentId || runTodoAgentMutation.isPending}
                    onClick={() => runTodoAgentMutation.mutate({ id: detailTarget.id })}
                  >
                    에이전트 실행
                  </Button>
                </div>
                {todoAgentResult && (
                  <div className="rounded-md border bg-muted/40 p-2 text-xs">
                    <p className="text-[11px] font-medium text-muted-foreground">응답</p>
                    <p className="mt-1 whitespace-pre-wrap">{todoAgentResult.content}</p>
                    {todoAgentResult.todo && todoAgentResult.todo.length > 0 ? (
                      <TodoMessage items={todoAgentResult.todo} />
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled>
                수정 (준비중)
              </Button>
              <Button size="sm" variant="destructive" disabled>
                삭제 (준비중)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
