import { ko } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import {
  useSchedulesByDay,
  useSchedulesByMonth,
  useToggleScheduleDone,
  useToggleRecurringScheduleDone,
} from '@/hooks/queries/schedule-query'
import { format } from 'date-fns'
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import { Badge } from '@/components/ui/badge'
import { useRecurringScheduleTemplateList } from '@/hooks/queries/recurring-schedule-template-query'
import type { RecurringScheduleTemplateInterface } from '@/types/recurring-schedule-template.type'

export const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data: schedulesByDay, isPending } = useSchedulesByDay(selectedDateStr)

  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth() + 1
  const { data: schedulesByMonth } = useSchedulesByMonth(year, month)

  const { data: recurringTemplates = [] } = useRecurringScheduleTemplateList()

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
          description: t.description,
          done: false,
          type: 'RECURRING_OCCURRENCE',
          occurrenceDate: dateStr,
          startAt: `${dateStr}T${t.startTime}`,
          endAt: `${dateStr}T${t.endTime}`,
          recurringTemplateId: t.id,
          calendarEventId: null,
          todoId: null,
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

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-2xl shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (!d) return
            setSelectedDate(d)
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
        <h2 className="text-sm font-semibold">
          {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </h2>
        <div className="space-y-1 text-xs">
          {isPending && <p className="text-muted-foreground">불러오는 중...</p>}
          {!isPending && schedulesForSelectedDay.length === 0 && (
            <p className="text-muted-foreground">이 날짜에는 스케줄이 없습니다.</p>
          )}
          {!isPending &&
            schedulesForSelectedDay.map((s) => {
              const isDone = s.done
              const isRecurring =
                s.type === 'RECURRING_OCCURRENCE' && s.recurringTemplateId !== null
              return (
                <button
                  key={`${s.type}-${s.recurringTemplateId ?? s.calendarEventId ?? s.todoId ?? s.id}`}
                  type="button"
                  onClick={() => {
                    if (isRecurring && s.recurringTemplateId) {
                      toggleRecurringDoneMutation.mutate({
                        templateId: s.recurringTemplateId,
                        date: s.occurrenceDate,
                      })
                    } else {
                      toggleScheduleDoneMutation.mutate({ id: s.id })
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-accent/60"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        'inline-flex size-4 items-center justify-center rounded-full border text-[10px] ' +
                        (isDone
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground')
                      }
                    >
                      {isDone ? '✓' : ''}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p
                        className={
                          'truncate font-medium ' +
                          (isDone ? 'text-muted-foreground line-through' : 'text-foreground')
                        }
                      >
                        {s.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(s.startAt), 'HH:mm')} ~{' '}
                        {format(new Date(s.endAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                    {s.type === 'RECURRING_OCCURRENCE'
                      ? '정기'
                      : s.type === 'CALENDAR_EVENT'
                        ? '일정'
                        : '할 일'}
                  </Badge>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
