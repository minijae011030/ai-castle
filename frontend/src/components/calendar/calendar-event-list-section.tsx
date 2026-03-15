import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { CalendarEventInterface } from '@/types/calendar.type'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

interface CalendarEventListSectionPropsInterface {
  selected_date: Date
  events_on_selected: CalendarEventInterface[]
  is_pending: boolean
  on_click_create: () => void
  on_click_edit: (event: CalendarEventInterface) => void
  on_click_delete: (id: number) => void
  to_datetime_local: (iso: string) => string
}

const CalendarEventListSection = ({
  selected_date,
  events_on_selected,
  is_pending,
  on_click_create,
  on_click_edit,
  on_click_delete,
  to_datetime_local,
}: CalendarEventListSectionPropsInterface) => {
  return (
    <div className="min-w-0 flex-1 rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {format(selected_date, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </h2>
        <Button size="sm" onClick={on_click_create}>
          <PlusIcon className="size-4" />
          추가
        </Button>
      </div>

      {is_pending ? (
        <p className="text-muted-foreground text-sm">불러오는 중...</p>
      ) : events_on_selected.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">이 날짜의 일정이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events_on_selected.map((event) => (
            <Card key={event.id} size="sm">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <span className="font-medium">{event.title}</span>
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
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>
                  {to_datetime_local(event.startAt)} ~ {to_datetime_local(event.endAt)}
                </p>
                {event.memo && <p className="line-clamp-2">{event.memo}</p>}
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}

export { CalendarEventListSection }
