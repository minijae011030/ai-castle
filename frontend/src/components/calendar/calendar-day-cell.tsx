import { cn } from '@/lib/utils'
import type { CalendarEventInterface } from '@/types/calendar.type'
import type { RecurringScheduleDataInterface } from '@/types/recurring-schedule.type'
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import React, { useMemo } from 'react'

/** 이벤트가 해당 날짜에 걸쳐 있는지 (해당 날 하루 중에라도 겹치면 true) */
function isEventOnDate(event: CalendarEventInterface, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  const eventStart = startOfDay(parseISO(event.startAt))
  const eventEnd = endOfDay(parseISO(event.endAt))
  return (
    isWithinInterval(dayStart, { start: eventStart, end: eventEnd }) ||
    isWithinInterval(dayEnd, { start: eventStart, end: eventEnd }) ||
    isWithinInterval(eventStart, { start: dayStart, end: dayEnd })
  )
}

/** 제목 잘라서 표시 (최대 max_len, 초과 시 "..") */
function truncateTitle(title: string, max_len: number): string {
  const t = title.trim()
  if (t.length <= max_len) return t
  return t.slice(0, max_len - 1) + '..'
}

const MAX_EVENTS_IN_CELL = 2
const TITLE_MAX_LEN = 8

interface CalendarDayCellPropsInterface extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  day: { date: Date }
  modifiers: Record<string, boolean>
  events: CalendarEventInterface[]
  recurringSchedules: RecurringScheduleDataInterface[]
  locale?: { code?: string }
}

type CellItemInterface = {
  key: string
  title: string
}

/** 캘린더 셀: 왼쪽 위 날짜 + 제목 최대 2개 + +N 배지 */
export const CalendarDayCell = React.forwardRef<HTMLButtonElement, CalendarDayCellPropsInterface>(
  ({ day, modifiers, events, recurringSchedules, locale, className, ...button_props }, ref) => {
    const dayEvents = useMemo(
      () => events.filter((event) => isEventOnDate(event, day.date)),
      [events, day.date],
    )

    const recurringTitles = useMemo(() => {
      if (!recurringSchedules.length) return [] as string[]
      const weekday_ix = day.date.getDay() // 0 (Sun) - 6 (Sat)

      const code = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][weekday_ix]
      return recurringSchedules
        .filter((s) => {
          if (!s.periodStart || !s.periodEnd) return false
          const dIso = day.date.toISOString().slice(0, 10)
          const inRange = dIso >= s.periodStart && dIso <= s.periodEnd
          if (!inRange) return false
          if (!s.weekdays) return false
          return s.weekdays
            .split(',')
            .map((w: string) => w.trim())
            .includes(code)
        })
        .map((s: RecurringScheduleDataInterface) => s.title)
    }, [recurringSchedules, day.date])

    const items: CellItemInterface[] = useMemo(() => {
      const normalItems = dayEvents.map<CellItemInterface>((e) => ({
        key: `e-${e.id}`,
        title: e.title,
      }))
      const recurringItems = recurringTitles.map<CellItemInterface>((title, index) => ({
        key: `r-${index}-${day.date.toISOString().slice(0, 10)}`,
        title,
      }))
      return [...normalItems, ...recurringItems]
    }, [dayEvents, recurringTitles, day.date])

    const showItems = items.slice(0, MAX_EVENTS_IN_CELL)
    const restCount = items.length - MAX_EVENTS_IN_CELL

    return (
      <button
        ref={ref}
        type="button"
        data-day={day.date.toLocaleDateString(locale?.code)}
        data-selected-single={
          modifiers.selected &&
          !modifiers.range_start &&
          !modifiers.range_end &&
          !modifiers.range_middle
        }
        className={cn(
          'relative isolate z-10 flex h-full min-h-[5rem] w-full flex-col items-start justify-start gap-0.5 border-0 p-1.5 text-left text-xs font-normal leading-tight outline-none ring-0 transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary/90 data-[selected-single=true]:hover:text-primary-foreground [.group/day[data-today]_&]:bg-muted [.group/day[data-today]_&]:text-foreground',
          className,
        )}
        {...button_props}
      >
        <span className="shrink-0 font-medium text-inherit">{format(day.date, 'd')}</span>
        <div className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-hidden">
          {showItems.map((item: CellItemInterface) => (
            <span
              key={item.key}
              className="block w-full truncate rounded bg-primary/20 px-1 py-0.5 text-[0.65rem] data-[selected-single=true]:bg-primary-foreground/20"
              title={item.title}
            >
              {truncateTitle(item.title, TITLE_MAX_LEN)}
            </span>
          ))}
          {restCount > 0 && (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[0.65rem] font-medium text-white">
              +{restCount}
            </span>
          )}
        </div>
      </button>
    )
  },
)

CalendarDayCell.displayName = 'CalendarDayCell'
