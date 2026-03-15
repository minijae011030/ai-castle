import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useCalendarEventList,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '@/hooks/queries/calendar-query'
import type { CalendarEventInterface } from '@/types/calendar.type'
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** datetime-local 값 → API용 ISO 형식 (초 포함) */
function toApiDatetime(value: string): string {
  if (!value) return ''
  return value.length === 16 ? `${value}:00` : value
}

/** API ISO 문자열 → datetime-local value */
function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

/** 이벤트가 해당 날짜에 걸쳐 있는지 (해당 날 하루 중에라도 겹치면 true) */
function isEventOnDate(event: CalendarEventInterface, date: Date): boolean {
  const day_start = startOfDay(date)
  const day_end = endOfDay(date)
  const event_start = startOfDay(parseISO(event.startAt))
  const event_end = endOfDay(parseISO(event.endAt))
  return (
    isWithinInterval(day_start, { start: event_start, end: event_end }) ||
    isWithinInterval(day_end, { start: event_start, end: event_end }) ||
    isWithinInterval(event_start, { start: day_start, end: day_end })
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

const default_form = {
  title: '',
  startAt: '',
  endAt: '',
  memo: '',
}

/** 셀 안: 왼쪽 위 날짜 + [ 제목 ] 최대 2개 + +N */
const CalendarDayCell = React.forwardRef<
  HTMLButtonElement,
  {
    day: { date: Date }
    modifiers: Record<string, boolean>
    events: CalendarEventInterface[]
    locale?: { code?: string }
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function CalendarDayCell({ day, modifiers, events, locale, className, ...button_props }, ref) {
  const day_events = useMemo(
    () => events.filter((e) => isEventOnDate(e, day.date)),
    [events, day.date],
  )
  const show_events = day_events.slice(0, MAX_EVENTS_IN_CELL)
  const rest_count = day_events.length - MAX_EVENTS_IN_CELL

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
        {show_events.map((e) => (
          <span
            key={e.id}
            className="block w-full truncate rounded bg-primary/20 px-1 py-0.5 text-[0.65rem] data-[selected-single=true]:bg-primary-foreground/20"
            title={e.title}
          >
            [ {truncateTitle(e.title, TITLE_MAX_LEN)} ]
          </span>
        ))}
        {rest_count > 0 && (
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[0.65rem] font-medium text-white">
            +{rest_count}
          </span>
        )}
      </div>
    </button>
  )
})

const CalendarPage = () => {
  const { data: events = [], isPending } = useCalendarEventList()
  const create_mutation = useCreateCalendarEvent()
  const update_mutation = useUpdateCalendarEvent()
  const delete_mutation = useDeleteCalendarEvent()

  const [selected_date, set_selected_date] = useState<Date>(() => new Date())
  const [dialog_open, set_dialog_open] = useState(false)
  const [editing_event, set_editing_event] = useState<CalendarEventInterface | null>(null)
  const [form, set_form] = useState(default_form)
  const [delete_target_id, set_delete_target_id] = useState<number | null>(null)

  const events_on_selected = useMemo(
    () => events.filter((e) => isEventOnDate(e, selected_date)),
    [events, selected_date],
  )

  const open_create = useCallback(() => {
    set_editing_event(null)
    const base = format(selected_date, 'yyyy-MM-dd')
    set_form({
      ...default_form,
      startAt: `${base}T09:00`,
      endAt: `${base}T10:00`,
    })
    set_dialog_open(true)
  }, [selected_date])

  const open_edit = useCallback((event: CalendarEventInterface) => {
    set_editing_event(event)
    set_form({
      title: event.title,
      startAt: toDatetimeLocal(event.startAt),
      endAt: toDatetimeLocal(event.endAt),
      memo: event.memo ?? '',
    })
    set_dialog_open(true)
  }, [])

  const close_dialog = useCallback(() => {
    set_dialog_open(false)
    set_editing_event(null)
    set_form(default_form)
  }, [])

  const submit = () => {
    const title = form.title.trim()
    if (!title) return
    const start_at = toApiDatetime(form.startAt)
    const end_at = toApiDatetime(form.endAt)
    if (!start_at || !end_at) return

    const on_success = () => close_dialog()

    if (editing_event) {
      update_mutation.mutate(
        {
          id: editing_event.id,
          body: {
            title,
            startAt: start_at,
            endAt: end_at,
            memo: form.memo || undefined,
          },
        },
        { onSuccess: on_success },
      )
    } else {
      create_mutation.mutate(
        {
          title,
          startAt: start_at,
          endAt: end_at,
          memo: form.memo || undefined,
        },
        { onSuccess: on_success },
      )
    }
  }

  const confirm_delete = (id: number) => {
    delete_mutation.mutate(id, {
      onSuccess: () => set_delete_target_id(null),
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-[42rem] shrink-0">
        <Calendar
          mode="single"
          selected={selected_date}
          onSelect={(d) => d && set_selected_date(d)}
          locale={ko}
          className="[--cell-size:6rem]"
          classNames={{
            table: 'table-fixed w-full',
            day: 'min-h-[5rem] min-w-[var(--cell-size)] w-[var(--cell-size)] max-w-[var(--cell-size)] aspect-auto align-top',
          }}
          components={{
            DayButton: (props) => <CalendarDayCell events={events} locale={ko} {...props} />,
          }}
        />
      </div>

      {/* 오른쪽: 선택한 날짜의 일정 카드 목록 */}
      <div className="min-w-0 flex-1 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {format(selected_date, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </h2>
          <Button size="sm" onClick={open_create}>
            <PlusIcon className="size-4" />
            추가
          </Button>
        </div>

        {isPending ? (
          <p className="text-muted-foreground text-sm">불러오는 중...</p>
        ) : events_on_selected.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            이 날짜의 일정이 없습니다.
          </p>
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
                      onClick={() => open_edit(event)}
                      aria-label="수정"
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => set_delete_target_id(event.id)}
                      aria-label="삭제"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {toDatetimeLocal(event.startAt)} ~ {toDatetimeLocal(event.endAt)}
                  </p>
                  {event.memo && <p className="line-clamp-2">{event.memo}</p>}
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </div>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialog_open} onOpenChange={(open) => !open && close_dialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing_event ? '이벤트 수정' : '이벤트 추가'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => set_form((p) => ({ ...p, title: e.target.value }))}
                placeholder="제목"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-start">시작</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => set_form((p) => ({ ...p, startAt: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-end">종료</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => set_form((p) => ({ ...p, endAt: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-memo">메모 (선택)</Label>
              <Textarea
                id="event-memo"
                value={form.memo}
                onChange={(e) => set_form((p) => ({ ...p, memo: e.target.value }))}
                placeholder="메모"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button
              onClick={submit}
              disabled={
                !form.title.trim() ||
                !form.startAt ||
                !form.endAt ||
                create_mutation.isPending ||
                update_mutation.isPending
              }
            >
              {editing_event ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={delete_target_id !== null}
        onOpenChange={(open) => !open && set_delete_target_id(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이벤트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 이벤트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => delete_target_id !== null && confirm_delete(delete_target_id)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { CalendarPage }
