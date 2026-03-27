import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import { format } from 'date-fns'

interface ScheduleDayListPanelPropsInterface {
  schedules: ScheduleOccurrenceInterface[]
  isPending: boolean
  emptyText?: string
  maxHeightClassName?: string
  selectedKey?: string | null
  onSelect?: (key: string) => void
  onToggleDone?: (schedule: ScheduleOccurrenceInterface) => void
}

export const ScheduleDayListPanel = ({
  schedules,
  isPending,
  emptyText = '이 날짜에는 스케줄이 없습니다.',
  maxHeightClassName = 'max-h-[280px]',
  selectedKey = null,
  onSelect,
  onToggleDone,
}: ScheduleDayListPanelPropsInterface) => {
  return (
    <div className="rounded-md border bg-card/30 p-2">
      {isPending && <p className="px-1 py-1 text-xs text-muted-foreground">불러오는 중...</p>}
      {!isPending && schedules.length === 0 && (
        <p className="px-1 py-1 text-xs text-muted-foreground">{emptyText}</p>
      )}
      {!isPending && schedules.length > 0 && (
        <div className={cn(maxHeightClassName, 'space-y-1 overflow-y-auto pr-1 text-xs')}>
          {schedules.map((schedule) => {
            const itemKey = `${schedule.type}-${schedule.recurringTemplateId ?? schedule.id}`
            const isActive = selectedKey === itemKey
            return (
              <div
                key={itemKey}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(itemKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect?.(itemKey)
                  }
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left',
                  'cursor-pointer hover:bg-accent/60',
                  isActive && 'border-primary/40 bg-accent/30',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label="완료 토글"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleDone?.(schedule)
                    }}
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-full border text-[10px]',
                      schedule.done
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {schedule.done ? '✓' : ''}
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={cn(
                        'truncate font-medium',
                        schedule.done ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {schedule.category?.trim()
                        ? `[${schedule.category.trim()}] ${schedule.title}`
                        : schedule.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(schedule.startAt), 'HH:mm')} ~{' '}
                      {format(new Date(schedule.endAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {schedule.type === 'RECURRING_OCCURRENCE'
                    ? '정기'
                    : schedule.type === 'CALENDAR_EVENT'
                      ? '일정'
                      : '할 일'}
                </Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
