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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  useCalendarEventList,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '@/hooks/queries/calendar-query'
import {
  useCreateRecurringSchedule,
  useRecurringScheduleList,
} from '@/hooks/queries/recurring-schedule-query'
import { useCreateTodo, useTodoListByDate, useUpdateTodoStatus } from '@/hooks/queries/todo-query'
import type { CalendarEventInterface } from '@/types/calendar.type'
import type { TodoCreateBodyInterface, TodoItemInterface, TodoStatus } from '@/types/todo.type'
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
  const { data: recurring_schedules = [], isPending: isRecurringPending } =
    useRecurringScheduleList()
  const create_mutation = useCreateCalendarEvent()
  const update_mutation = useUpdateCalendarEvent()
  const delete_mutation = useDeleteCalendarEvent()
  const create_recurring_mutation = useCreateRecurringSchedule()
  const create_todo_mutation = useCreateTodo()
  const update_todo_status_mutation = useUpdateTodoStatus()

  const [selected_date, set_selected_date] = useState<Date>(() => new Date())
  // 사용자가 완료 처리한 일정/정기일정 ID 목록 (프론트 로컬 상태)
  const [completed_event_ids, set_completed_event_ids] = useState<number[]>([])
  const [completed_recurring_ids, set_completed_recurring_ids] = useState<number[]>([])

  // 일정(단일 이벤트) 수정/추가 다이얼로그 (기존)
  const [event_dialog_open, set_event_dialog_open] = useState(false)
  const [editing_event, set_editing_event] = useState<CalendarEventInterface | null>(null)
  const [form, set_form] = useState(default_form)
  const [delete_target_id, set_delete_target_id] = useState<number | null>(null)

  // 공통 추가 다이얼로그 (정기일정 | 일정 | 할 일)
  const [create_dialog_open, set_create_dialog_open] = useState(false)
  const [create_tab, set_create_tab] = useState<'recurring' | 'event' | 'todo'>('event')

  // 정기일정 폼 상태
  const [recurring_title, set_recurring_title] = useState('')
  const [recurring_start_date, set_recurring_start_date] = useState('')
  const [recurring_end_date, set_recurring_end_date] = useState('')
  const [recurring_weekdays, set_recurring_weekdays] = useState<string[]>([])
  const [recurring_start_time, set_recurring_start_time] = useState('')
  const [recurring_end_time, set_recurring_end_time] = useState('')
  const [recurring_memo, set_recurring_memo] = useState('')

  // 일정(단일 이벤트) 생성 폼 상태
  const [create_event_title, set_create_event_title] = useState('')
  const [create_event_start_at, set_create_event_start_at] = useState('')
  const [create_event_end_at, set_create_event_end_at] = useState('')
  const [create_event_memo, set_create_event_memo] = useState('')

  // 할 일 생성 폼 상태
  const [todo_title, set_todo_title] = useState('')
  const [todo_description, set_todo_description] = useState('')
  const [todo_agent_role_id, set_todo_agent_role_id] = useState<string>('1')
  const [todo_order_index, set_todo_order_index] = useState<string>('')

  const selected_date_str = useMemo(() => format(selected_date, 'yyyy-MM-dd'), [selected_date])
  const { data: todos = [], isPending: isTodoPending } = useTodoListByDate(selected_date_str)

  const events_on_selected = useMemo(
    () => events.filter((e) => isEventOnDate(e, selected_date)),
    [events, selected_date],
  )

  // 선택된 날짜에 실제로 해당되는 정기 일정만 필터링 (우측 컬럼용 존재 여부 체크)
  const recurring_on_selected = useMemo(() => {
    const selected_weekday_index = selected_date.getDay()
    const weekday_by_index: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const selected_weekday_code = weekday_by_index[selected_weekday_index]

    return recurring_schedules.filter((item) => {
      const in_period = item.periodStart <= selected_date_str && selected_date_str <= item.periodEnd
      if (!in_period) return false

      if (!selected_weekday_code) return false

      const weekday_tokens = item.weekdays
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      return weekday_tokens.includes(selected_weekday_code)
    })
  }, [recurring_schedules, selected_date, selected_date_str])

  const close_event_dialog = useCallback(() => {
    set_event_dialog_open(false)
    set_editing_event(null)
    set_form(default_form)
  }, [])

  const submit = () => {
    const title = form.title.trim()
    if (!title) return
    const start_at = toApiDatetime(form.startAt)
    const end_at = toApiDatetime(form.endAt)
    if (!start_at || !end_at) return

    const on_success = () => close_event_dialog()

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
          onSelect={(d) => {
            if (!d) return
            // 날짜 변경 시 선택 날짜만 바꾸고, 완료 체크 상태는 유지
            set_selected_date(d)
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {format(selected_date, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // 공통 추가 다이얼로그 초기화
              const base = format(selected_date, 'yyyy-MM-dd')
              const weekday_by_index: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
              const selected_weekday_code = weekday_by_index[selected_date.getDay()]

              set_create_tab('event')
              // 정기일정 기본값
              set_recurring_title('')
              set_recurring_start_date(base)
              set_recurring_end_date(base)
              set_recurring_weekdays(selected_weekday_code ? [selected_weekday_code] : [])
              set_recurring_start_time('09:00')
              set_recurring_end_time('10:00')
              set_recurring_memo('')
              // 일정 기본값
              set_create_event_title('')
              set_create_event_start_at(`${base}T09:00`)
              set_create_event_end_at(`${base}T10:00`)
              set_create_event_memo('')
              // Todo 기본값
              set_todo_title('')
              set_todo_description('')
              set_todo_order_index('')
              set_todo_agent_role_id('1')

              set_create_dialog_open(true)
            }}
          >
            + 추가
          </Button>
        </div>
        <RecurringScheduleSection
          selected_date={selected_date}
          recurring_schedules={recurring_schedules}
          is_pending={isRecurringPending}
          completed_recurring_ids={completed_recurring_ids}
          on_toggle_completed={(id) => {
            // 정기 일정 완료 토글
            set_completed_recurring_ids((prev_ids) =>
              prev_ids.includes(id)
                ? prev_ids.filter((recurring_id) => recurring_id !== id)
                : [...prev_ids, id],
            )
          }}
        />
        <CalendarEventListSection
          events_on_selected={events_on_selected}
          is_pending={isPending}
          on_click_edit={(event) => {
            set_editing_event(event)
            set_form({
              title: event.title,
              startAt: event.startAt.slice(0, 16),
              endAt: event.endAt.slice(0, 16),
              memo: event.memo ?? '',
            })
            set_event_dialog_open(true)
          }}
          on_click_delete={(id) => set_delete_target_id(id)}
          completed_event_ids={completed_event_ids}
          on_toggle_completed={(id) => {
            // 일정 완료 토글 (이미 완료면 해제, 아니면 완료로 표시)
            set_completed_event_ids((prev_ids) =>
              prev_ids.includes(id)
                ? prev_ids.filter((event_id) => event_id !== id)
                : [...prev_ids, id],
            )
          }}
        />
        <TodayTodoSection
          todos={todos}
          is_pending={isTodoPending}
          on_toggle_completed={(todo: TodoItemInterface) => {
            // Todo 상태를 서버에 반영 (DONE <-> PENDING 토글)
            const next_status: TodoStatus = todo.status === 'DONE' ? 'PENDING' : 'DONE'
            update_todo_status_mutation.mutate({
              id: todo.id,
              body: { status: next_status },
            })
          }}
        />
        {!isPending &&
          !isRecurringPending &&
          !isTodoPending &&
          events_on_selected.length === 0 &&
          recurring_on_selected.length === 0 &&
          todos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              해당 날짜에는 정기 일정, 일정, 할 일이 없습니다.
            </p>
          )}
      </div>

      {/* 일정(단일 이벤트) 추가/수정 다이얼로그 (기존) */}
      <Dialog open={event_dialog_open} onOpenChange={(open) => !open && close_event_dialog()}>
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

      {/* 공통 추가 다이얼로그: 정기일정 | 일정 | 할 일 */}
      <Dialog open={create_dialog_open} onOpenChange={set_create_dialog_open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 일정 추가</DialogTitle>
          </DialogHeader>

          <Tabs value={create_tab} onValueChange={(v) => set_create_tab(v as typeof create_tab)}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="recurring">정기일정</TabsTrigger>
              <TabsTrigger value="event">일정</TabsTrigger>
              <TabsTrigger value="todo">할 일</TabsTrigger>
            </TabsList>

            {/* 정기일정 추가 폼 */}
            <TabsContent value="recurring" className="mt-0 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="create-recurring-title">제목</Label>
                <Input
                  id="create-recurring-title"
                  value={recurring_title}
                  onChange={(e) => set_recurring_title(e.target.value)}
                  placeholder="예: 알바"
                />
              </div>
              <div className="grid gap-2">
                <Label>기간 (필수)</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={recurring_start_date}
                    onChange={(e) => set_recurring_start_date(e.target.value)}
                  />
                  <span className="self-center text-xs text-muted-foreground">~</span>
                  <Input
                    type="date"
                    value={recurring_end_date}
                    onChange={(e) => set_recurring_end_date(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>요일 (최소 1개)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: 'MON', label: '월' },
                    { code: 'TUE', label: '화' },
                    { code: 'WED', label: '수' },
                    { code: 'THU', label: '목' },
                    { code: 'FRI', label: '금' },
                    { code: 'SAT', label: '토' },
                    { code: 'SUN', label: '일' },
                  ].map((opt) => {
                    const active = recurring_weekdays.includes(opt.code)
                    return (
                      <Button
                        key={opt.code}
                        type="button"
                        size="xs"
                        variant={active ? 'default' : 'outline'}
                        className={active ? 'h-7 px-2 text-xs font-semibold' : 'h-7 px-2 text-xs'}
                        onClick={() =>
                          set_recurring_weekdays((prev) =>
                            prev.includes(opt.code)
                              ? prev.filter((c) => c !== opt.code)
                              : [...prev, opt.code],
                          )
                        }
                      >
                        {opt.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>시간 (필수)</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={recurring_start_time}
                    onChange={(e) => set_recurring_start_time(e.target.value)}
                  />
                  <span className="self-center text-xs text-muted-foreground">~</span>
                  <Input
                    type="time"
                    value={recurring_end_time}
                    onChange={(e) => set_recurring_end_time(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-recurring-memo">메모 (선택)</Label>
                <Textarea
                  id="create-recurring-memo"
                  value={recurring_memo}
                  onChange={(e) => set_recurring_memo(e.target.value)}
                  placeholder="예: 매장 A, 주휴수당 포함 등"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !recurring_title.trim() ||
                    !recurring_start_date ||
                    !recurring_end_date ||
                    recurring_start_date > recurring_end_date ||
                    recurring_weekdays.length === 0 ||
                    !recurring_start_time ||
                    !recurring_end_time ||
                    recurring_start_time >= recurring_end_time ||
                    create_recurring_mutation.isPending
                  }
                  onClick={async () => {
                    const payload = {
                      title: recurring_title.trim(),
                      periodStart: recurring_start_date,
                      periodEnd: recurring_end_date,
                      weekdays: recurring_weekdays.join(','),
                      startTime: recurring_start_time,
                      endTime: recurring_end_time,
                      memo: recurring_memo.trim() || undefined,
                    }

                    await create_recurring_mutation.mutateAsync(payload, {
                      onSuccess: () => {
                        set_create_dialog_open(false)
                      },
                    })
                  }}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* 단일 일정 추가 폼 */}
            <TabsContent value="event" className="mt-0 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="create-event-title">제목</Label>
                <Input
                  id="create-event-title"
                  value={create_event_title}
                  onChange={(e) => set_create_event_title(e.target.value)}
                  placeholder="제목"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-start">시작</Label>
                <Input
                  id="create-event-start"
                  type="datetime-local"
                  value={create_event_start_at}
                  onChange={(e) => set_create_event_start_at(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-end">종료</Label>
                <Input
                  id="create-event-end"
                  type="datetime-local"
                  value={create_event_end_at}
                  onChange={(e) => set_create_event_end_at(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-memo">메모 (선택)</Label>
                <Textarea
                  id="create-event-memo"
                  value={create_event_memo}
                  onChange={(e) => set_create_event_memo(e.target.value)}
                  placeholder="메모"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !create_event_title.trim() ||
                    !create_event_start_at ||
                    !create_event_end_at ||
                    create_mutation.isPending
                  }
                  onClick={() => {
                    const title = create_event_title.trim()
                    const start_at = toApiDatetime(create_event_start_at)
                    const end_at = toApiDatetime(create_event_end_at)
                    if (!title || !start_at || !end_at) return

                    create_mutation.mutate(
                      {
                        title,
                        startAt: start_at,
                        endAt: end_at,
                        memo: create_event_memo.trim() || undefined,
                      },
                      {
                        onSuccess: () => {
                          set_create_dialog_open(false)
                        },
                      },
                    )
                  }}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* 할 일 추가 폼 */}
            <TabsContent value="todo" className="mt-0 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="create-todo-title">제목</Label>
                <Input
                  id="create-todo-title"
                  value={todo_title}
                  onChange={(e) => set_todo_title(e.target.value)}
                  placeholder="예: 알고리즘 문제 3개 풀기"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-todo-description">설명 (선택)</Label>
                <Textarea
                  id="create-todo-description"
                  value={todo_description}
                  onChange={(e) => set_todo_description(e.target.value)}
                  placeholder="세부 설명을 입력해 주세요."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-todo-agent">담당 에이전트 ID</Label>
                <Input
                  id="create-todo-agent"
                  type="number"
                  min={1}
                  value={todo_agent_role_id}
                  onChange={(e) => set_todo_agent_role_id(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-todo-order">정렬 순서 (선택)</Label>
                <Input
                  id="create-todo-order"
                  type="number"
                  value={todo_order_index}
                  onChange={(e) => set_todo_order_index(e.target.value)}
                  placeholder="작은 숫자일수록 먼저 표시"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !todo_title.trim() ||
                    !todo_agent_role_id.trim() ||
                    create_todo_mutation.isPending
                  }
                  onClick={() => {
                    const body: TodoCreateBodyInterface = {
                      agentRoleId: Number(todo_agent_role_id),
                      title: todo_title.trim(),
                      description: todo_description.trim() || undefined,
                      scheduledDate: selected_date_str,
                      orderIndex: todo_order_index ? Number(todo_order_index) : undefined,
                    }

                    if (!body.agentRoleId || Number.isNaN(body.agentRoleId)) {
                      return
                    }

                    create_todo_mutation.mutate(body, {
                      onSuccess: () => {
                        set_create_dialog_open(false)
                      },
                    })
                  }}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
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
