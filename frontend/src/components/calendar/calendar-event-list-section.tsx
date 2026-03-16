import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { format_date_time } from '@/lib/format'
import type { CalendarEventInterface } from '@/types/calendar.type'
import { PencilIcon, Trash2Icon } from 'lucide-react'

interface CalendarEventListSectionPropsInterface {
  events_on_selected: CalendarEventInterface[]
  is_pending: boolean
  on_click_edit: (event: CalendarEventInterface) => void
  on_click_delete: (id: number) => void
}

const CalendarEventListSection = ({
  events_on_selected,
  is_pending,
  on_click_edit,
  on_click_delete,
}: CalendarEventListSectionPropsInterface) => {
  if (is_pending || events_on_selected.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 flex-1 space-y-2 text-xs">
      <ul className="flex flex-col gap-2">
        {events_on_selected.map((event) => (
          <Card key={event.id} size="sm">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <span className="text-xs font-medium">{event.title}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => on_click_edit(event)}
                  aria-label="수정"
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => on_click_delete(event.id)}
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

export { CalendarEventListSection }
