import type { CalendarDayButton as CalendarDayButtonType } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'

type CalendarDayCellProps = React.ComponentProps<typeof CalendarDayButtonType> & {
  schedules: ScheduleOccurrenceInterface[]
}

// 한 날짜 셀 렌더러.
// - 1행: 날짜 (children)
// - 2행~3행: 상위 2개 스케줄 제목
// - 마지막 행: 남은 개수 있으면 "+N"
export const CalendarDayCell = ({
  schedules,
  children,
  modifiers,
  ...props
}: CalendarDayCellProps) => {
  const sorted = [...schedules].sort((a, b) => a.startAt.localeCompare(b.startAt))
  const topTwo = sorted.slice(0, 2)
  const restCount = Math.max(sorted.length - topTwo.length, 0)
  const isSelected = Boolean(modifiers?.selected)

  return (
    <CalendarDayButton
      {...props}
      modifiers={modifiers}
      className="flex flex-col items-start justify-start gap-0.5 p-2 text-left"
    >
      <span
        className={
          'mb-0.5 text-[11px] font-medium ' +
          (isSelected ? 'text-primary-foreground' : 'text-muted-foreground')
        }
      >
        {children}
      </span>
      {topTwo.map((s) => (
        <div
          key={s.id}
          className={cn(
            'w-full truncate rounded-sm px-1.5 py-0.5 text-[10px]',
            isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground',
          )}
        >
          {s.title}
        </div>
      ))}
      {restCount > 0 && (
        <div className="flex w-full items-center justify-end">
          <span
            className={
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium ' +
              (isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')
            }
          >
            +{restCount}
          </span>
        </div>
      )}
    </CalendarDayButton>
  )
}
