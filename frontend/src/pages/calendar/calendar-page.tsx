import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { useRecurringScheduleList } from '@/hooks/queries/recurring-schedule-query'
import { useTodoListByDate } from '@/hooks/queries/todo-query'
import type { CalendarEventInterface } from '@/types/calendar.type'
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useCallback, useMemo, useState } from 'react'
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
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell'
import { CalendarEventListSection } from '@/components/calendar/calendar-event-list-section'
import { RecurringScheduleSection } from '@/components/calendar/recurring-schedule-section'
import { TodayTodoSection } from '@/components/calendar/today-todo-section'

/** datetime-local 값 → API용 ISO 형식 (초 포함) */
function toApiDatetime(value: string): string {
  if (!value) return ''
  return value.length === 16 ? `${value}:00` : value
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

const default_form = {
  title: '',
  startAt: '',
  endAt: '',
  memo: '',
}

const CalendarPage = () => {
  const { data: events = [], isPending } = useCalendarEventList()
  const { data: recurring_schedules = [] } = useRecurringScheduleList()
  const create_mutation = useCreateCalendarEvent()
  const update_mutation = useUpdateCalendarEvent()
  const delete_mutation = useDeleteCalendarEvent()

  const [selected_date, set_selected_date] = useState<Date>(() => new Date())
  const [dialog_open, set_dialog_open] = useState(false)
  const [editing_event, set_editing_event] = useState<CalendarEventInterface | null>(null)
  const [form, set_form] = useState(default_form)
  const [delete_target_id, set_delete_target_id] = useState<number | null>(null)

  const selected_date_str = useMemo(() => format(selected_date, 'yyyy-MM-dd'), [selected_date])
  const { data: todos = [] } = useTodoListByDate(selected_date_str)

  const events_on_selected = useMemo(
    () => events.filter((e) => isEventOnDate(e, selected_date)),
    [events, selected_date],
  )

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
            DayButton: (props) => (
              <CalendarDayCell
                events={events}
                recurring_schedules={recurring_schedules}
                locale={ko}
                {...props}
              />
            ),
          }}
        />
      </div>

      {/* 오른쪽: 정기 일정 + 일정 + Todo 를 한 컬럼에서 카드로 표시 */}
      <div className="min-w-0 flex-1 space-y-3">
        <h2 className="font-semibold">
          {format(selected_date, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </h2>
        <RecurringScheduleSection />
        <CalendarEventListSection
          selected_date={selected_date}
          events_on_selected={events_on_selected}
          is_pending={isPending}
          on_click_create={() => {
            const base = format(selected_date, 'yyyy-MM-dd')
            set_editing_event(null)
            set_form({
              ...default_form,
              startAt: `${base}T09:00`,
              endAt: `${base}T10:00`,
            })
            set_dialog_open(true)
          }}
          on_click_edit={(event) => {
            set_editing_event(event)
            set_form({
              title: event.title,
              startAt: event.startAt.slice(0, 16),
              endAt: event.endAt.slice(0, 16),
              memo: event.memo ?? '',
            })
            set_dialog_open(true)
          }}
          on_click_delete={(id) => set_delete_target_id(id)}
        />
        <TodayTodoSection todos={todos} />
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
