import { Button } from '@/components/ui/button'
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
import { useCreateCalendarEvent as useCreateEvent } from '@/hooks/queries/calendar-query'
import { useCreateRecurringSchedule } from '@/hooks/queries/recurring-schedule-query'
import { useCreateTodo } from '@/hooks/queries/todo-query'
import { toApiDatetime } from '@/lib/format'
import type { CalendarEventCreateBodyInterface } from '@/types/calendar.type'
import type { RecurringScheduleCreateBodyInterface } from '@/types/recurring-schedule.type'
import type { TodoCreateBodyInterface } from '@/types/todo.type'
import { format } from 'date-fns'
import { useState } from 'react'

interface CalendarCreateDialogPropsInterface {
  selected_date: Date
  selected_date_str: string
}

export const CalendarCreateDialog = ({
  selected_date,
  selected_date_str,
}: CalendarCreateDialogPropsInterface) => {
  const create_event_mutation = useCreateEvent()
  const create_recurring_mutation = useCreateRecurringSchedule()
  const create_todo_mutation = useCreateTodo()

  const [open, set_open] = useState(false)
  const [tab, set_tab] = useState<'recurring' | 'event' | 'todo'>('event')

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

  // 단일 일정 저장 버튼 클릭 핸들러
  const handleClickSaveEvent = () => {
    const payload: CalendarEventCreateBodyInterface = {
      title: create_event_title.trim(),
      startAt: toApiDatetime(create_event_start_at),
      endAt: toApiDatetime(create_event_end_at),
      memo: create_event_memo.trim() || undefined,
    }

    create_event_mutation.mutate(payload, {
      onSuccess: () => set_open(false),
    })
  }

  const handleClickSaveRecurring = async () => {
    const payload: RecurringScheduleCreateBodyInterface = {
      title: recurring_title.trim(),
      periodStart: recurring_start_date,
      periodEnd: recurring_end_date,
      weekdays: recurring_weekdays.join(','),
      startTime: recurring_start_time,
      endTime: recurring_end_time,
      memo: recurring_memo.trim() || undefined,
    }

    await create_recurring_mutation.mutateAsync(payload, {
      onSuccess: () => set_open(false),
    })
  }

  const handleClickSaveTodo = () => {
    const payload: TodoCreateBodyInterface = {
      agentRoleId: Number(todo_agent_role_id),
      title: todo_title.trim(),
      description: todo_description.trim() || undefined,
      scheduledDate: selected_date_str,
      orderIndex: todo_order_index ? Number(todo_order_index) : undefined,
    }

    create_todo_mutation.mutate(payload, {
      onSuccess: () => set_open(false),
    })
  }

  const resetAndOpen = () => {
    const base = format(selected_date, 'yyyy-MM-dd')
    const weekday_by_index: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const selected_weekday_code = weekday_by_index[selected_date.getDay()]

    set_tab('event')

    // 정기일정 기본값
    set_recurring_title('')
    set_recurring_start_date(base)
    set_recurring_end_date(base)
    set_recurring_weekdays(selected_weekday_code ? [selected_weekday_code] : [])
    set_recurring_start_time('09:00')
    set_recurring_end_time('10:00')
    set_recurring_memo('')

    // 이벤트 기본값
    set_create_event_title('')
    set_create_event_start_at(`${base}T09:00`)
    set_create_event_end_at(`${base}T10:00`)
    set_create_event_memo('')

    // Todo 기본값
    set_todo_title('')
    set_todo_description('')
    set_todo_order_index('')
    set_todo_agent_role_id('1')

    set_open(true)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={resetAndOpen}>
        + 추가
      </Button>

      <Dialog open={open} onOpenChange={set_open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 일정 추가</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => set_tab(v as typeof tab)}>
            <TabsList className="mb-4 grid grid-cols-3">
              <TabsTrigger value="recurring">정기일정</TabsTrigger>
              <TabsTrigger value="event">일정</TabsTrigger>
              <TabsTrigger value="todo">할 일</TabsTrigger>
            </TabsList>

            {/* 정기일정 추가 */}
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
                  placeholder="예: 매장 A"
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
                  onClick={handleClickSaveRecurring}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* 단일 일정 추가 */}
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
                    create_event_mutation.isPending
                  }
                  onClick={handleClickSaveEvent}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* 할 일 추가 */}
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
                  onClick={handleClickSaveTodo}
                >
                  저장
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
