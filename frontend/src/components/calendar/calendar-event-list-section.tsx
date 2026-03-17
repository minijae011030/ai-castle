import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { format_date_time } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CalendarEventInterface } from '@/types/calendar.type'
import { CheckCircle2Icon, CircleIcon, PencilIcon, Trash2Icon } from 'lucide-react'

interface CalendarEventListSectionPropsInterface {
  eventsOnSelected: CalendarEventInterface[]
  isPending: boolean
  /** 해당 날짜에서 사용자가 완료 처리한 일정 ID 목록 */
  completedEventIds: number[]
  onEditClick: (event: CalendarEventInterface) => void
  onDeleteClick: (id: number) => void
  /** 일정 완료 토글 클릭 시 호출되는 콜백 */
  onToggleCompleted: (id: number) => void
}

export const CalendarEventListSection = ({
  eventsOnSelected,
  isPending,
  completedEventIds,
  onEditClick,
  onDeleteClick,
  onToggleCompleted,
}: CalendarEventListSectionPropsInterface) => {
  if (isPending || eventsOnSelected.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 flex-1 space-y-2 text-xs">
      <ul className="flex flex-col gap-2">
        {eventsOnSelected.map((event) => (
          <Card key={event.id} size="sm">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToggleCompleted(event.id)}
                  aria-label="완료 토글"
                >
                  {completedEventIds.includes(event.id) ? (
                    <CheckCircle2Icon className="size-4 text-primary" />
                  ) : (
                    <CircleIcon className="size-4 text-muted-foreground" />
                  )}
                </Button>
                <span
                  className={cn(
                    'text-xs font-medium',
                    completedEventIds.includes(event.id) && 'text-muted-foreground line-through',
                  )}
                >
                  {event.title}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEditClick(event)}
                  aria-label="수정"
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDeleteClick(event.id)}
                  aria-label="삭제"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                {format_date_time(event.startAt)} ~ {format_date_time(event.endAt)}
              </p>
              {event.memo && <p className="line-clamp-2">{event.memo}</p>}
            </CardContent>
          </Card>
        ))}
      </ul>
    </div>
  )
}
