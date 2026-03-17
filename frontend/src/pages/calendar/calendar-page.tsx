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
import { toApiDatetime } from '@/lib/format'

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

const defaultForm = {
  title: '',
  startAt: '',
  endAt: '',
  memo: '',
}

const CalendarPage = () => {
  const { data: events = [], isPending } = useCalendarEventList()
  const { data: recurringSchedules = [], isPending: isRecurringPending } =
    useRecurringScheduleList()

  const createMutation = useCreateCalendarEvent()
  const updateMutation = useUpdateCalendarEvent()
  const deleteMutation = useDeleteCalendarEvent()
  const createRecurringMutation = useCreateRecurringSchedule()
  const createTodoMutation = useCreateTodo()
  const updateTodoStatusMutation = useUpdateTodoStatus()

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  // 사용자가 완료 처리한 일정/정기일정 ID 목록 (프론트 로컬 상태)
  const [completedEventIds, setCompletedEventIds] = useState<number[]>([])
  const [completedRecurringIds, setCompletedRecurringIds] = useState<number[]>([])

  // 일정(단일 이벤트) 수정/추가 다이얼로그 (기존)
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEventInterface | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  // 공통 추가 다이얼로그 (정기일정 | 일정 | 할 일)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createTab, setCreateTab] = useState<'recurring' | 'event' | 'todo'>('event')

  // 정기일정 폼 상태
  const [recurringTitle, setRecurringTitle] = useState('')
  const [recurringStartDate, setRecurringStartDate] = useState('')
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [recurringWeekdays, setRecurringWeekdays] = useState<string[]>([])
  const [recurringStartTime, setRecurringStartTime] = useState('')
  const [recurringEndTime, setRecurringEndTime] = useState('')
  const [recurringMemo, setRecurringMemo] = useState('')

  // 일정(단일 이벤트) 생성 폼 상태
  const [createEventTitle, setCreateEventTitle] = useState('')
  const [createEventStartAt, setCreateEventStartAt] = useState('')
  const [createEventEndAt, setCreateEventEndAt] = useState('')
  const [createEventMemo, setCreateEventMemo] = useState('')

  // 할 일 생성 폼 상태
  const [todoTitle, setTodoTitle] = useState('')
  const [todoDescription, setTodoDescription] = useState('')
  const [todoAgentRoleId, setTodoAgentRoleId] = useState<string>('1')
  const [todoOrderIndex, setTodoOrderIndex] = useState<string>('')

  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate])
  const { data: todos = [], isPending: isTodoPending } = useTodoListByDate(selectedDateStr)

  const eventsOnSelected = useMemo(
    () => events.filter((e) => isEventOnDate(e, selectedDate)),
    [events, selectedDate],
  )

  // 선택된 날짜에 실제로 해당되는 정기 일정만 필터링 (우측 컬럼용 존재 여부 체크)
  const recurringOnSelected = useMemo(() => {
    const selectedWeekdayIndex = selectedDate.getDay()
    const weekdayByIndex: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const selectedWeekdayCode = weekdayByIndex[selectedWeekdayIndex]

    return recurringSchedules.filter((item) => {
      const inPeriod = item.periodStart <= selectedDateStr && selectedDateStr <= item.periodEnd
      if (!inPeriod) return false

      if (!selectedWeekdayCode) return false

      const weekdayTokens = item.weekdays
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      return weekdayTokens.includes(selectedWeekdayCode)
    })
  }, [recurringSchedules, selectedDate, selectedDateStr])

  const handleClickSaveRecurring = async () => {
    const payload = {
      title: recurringTitle.trim(),
      periodStart: recurringStartDate,
      periodEnd: recurringEndDate,
      weekdays: recurringWeekdays.join(','),
      startTime: recurringStartTime,
      endTime: recurringEndTime,
      memo: recurringMemo.trim() || undefined,
    }

    await createRecurringMutation.mutateAsync(payload, {
      onSuccess: () => {
        setCreateDialogOpen(false)
      },
    })
  }

  const closeEventDialog = useCallback(() => {
    setEventDialogOpen(false)
    setEditingEvent(null)
    setForm(defaultForm)
  }, [])

  const submit = () => {
    const title = form.title.trim()
    if (!title) return
    const startAt = toApiDatetime(form.startAt)
    const endAt = toApiDatetime(form.endAt)
    if (!startAt || !endAt) return

    const onSuccess = () => closeEventDialog()

    if (editingEvent) {
      updateMutation.mutate(
        {
          id: editingEvent.id,
          body: {
            title,
            startAt: startAt,
            endAt: endAt,
            memo: form.memo || undefined,
          },
        },
        { onSuccess: onSuccess },
      )
    } else {
      createMutation.mutate(
        {
          title,
          startAt: startAt,
          endAt: endAt,
          memo: form.memo || undefined,
        },
        { onSuccess: onSuccess },
      )
    }
  }

  const confirmDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setDeleteTargetId(null),
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-[42rem] shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (!d) return
            // 날짜 변경 시 선택 날짜만 바꾸고, 완료 체크 상태는 유지
            setSelectedDate(d)
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
                recurringSchedules={recurringSchedules}
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
            {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // 공통 추가 다이얼로그 초기화
              const base = format(selectedDate, 'yyyy-MM-dd')
              const weekday_by_index: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
              const selected_weekday_code = weekday_by_index[selectedDate.getDay()]

              setCreateTab('event')
              // 정기일정 기본값
              setRecurringTitle('')
              setRecurringStartDate(base)
              setRecurringEndDate(base)
              setRecurringWeekdays(selected_weekday_code ? [selected_weekday_code] : [])
              setRecurringStartTime('09:00')
              setRecurringEndTime('10:00')
              setRecurringMemo('')
              // 일정 기본값
              setCreateEventTitle('')
              setCreateEventStartAt(`${base}T09:00`)
              setCreateEventEndAt(`${base}T10:00`)
              setCreateEventMemo('')
              // Todo 기본값
              setTodoTitle('')
              setTodoDescription('')
              setTodoOrderIndex('')
              setTodoAgentRoleId('1')

              setCreateDialogOpen(true)
            }}
          >
            + 추가
          </Button>
        </div>
        <RecurringScheduleSection
          selectedDate={selectedDate}
          recurringSchedules={recurringSchedules}
          isPending={isRecurringPending}
          completedRecurringIds={completedRecurringIds}
          onToggleCompleted={(id) => {
            // 정기 일정 완료 토글
            setCompletedRecurringIds((prevIds) =>
              prevIds.includes(id)
                ? prevIds.filter((recurringId) => recurringId !== id)
                : [...prevIds, id],
            )
          }}
        />
        <CalendarEventListSection
          eventsOnSelected={eventsOnSelected}
          isPending={isPending}
          onEditClick={(event) => {
            setEditingEvent(event)
            setForm({
              title: event.title,
              startAt: event.startAt.slice(0, 16),
              endAt: event.endAt.slice(0, 16),
              memo: event.memo ?? '',
            })
            setEventDialogOpen(true)
          }}
          onDeleteClick={(id) => setDeleteTargetId(id)}
          completedEventIds={completedEventIds}
          onToggleCompleted={(id) => {
            // 일정 완료 토글 (이미 완료면 해제, 아니면 완료로 표시)
            setCompletedEventIds((prevIds) =>
              prevIds.includes(id) ? prevIds.filter((eventId) => eventId !== id) : [...prevIds, id],
            )
          }}
        />
        <TodayTodoSection
          todos={todos}
          isPending={isTodoPending}
          onToggleCompleted={(todo: TodoItemInterface) => {
            // Todo 상태를 서버에 반영 (DONE <-> PENDING 토글)
            const nextStatus: TodoStatus = todo.status === 'DONE' ? 'PENDING' : 'DONE'
            updateTodoStatusMutation.mutate({
              id: todo.id,
              body: { status: nextStatus },
            })
          }}
        />
        {!isPending &&
          !isRecurringPending &&
          !isTodoPending &&
          eventsOnSelected.length === 0 &&
          recurringOnSelected.length === 0 &&
          todos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              해당 날짜에는 정기 일정, 일정, 할 일이 없습니다.
            </p>
          )}
      </div>

      {/* 일정(단일 이벤트) 추가/수정 다이얼로그 (기존) */}
      <Dialog open={eventDialogOpen} onOpenChange={(open) => !open && closeEventDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? '이벤트 수정' : '이벤트 추가'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="제목"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-start">시작</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-end">종료</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-memo">메모 (선택)</Label>
              <Textarea
                id="event-memo"
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
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
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingEvent ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 공통 추가 다이얼로그: 정기일정 | 일정 | 할 일 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 일정 추가</DialogTitle>
          </DialogHeader>

          <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as typeof createTab)}>
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
                  value={recurringTitle}
                  onChange={(e) => setRecurringTitle(e.target.value)}
                  placeholder="예: 알바"
                />
              </div>
              <div className="grid gap-2">
                <Label>기간 (필수)</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={recurringStartDate}
                    onChange={(e) => setRecurringStartDate(e.target.value)}
                  />
                  <span className="self-center text-xs text-muted-foreground">~</span>
                  <Input
                    type="date"
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
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
                    const active = recurringWeekdays.includes(opt.code)
                    return (
                      <Button
                        key={opt.code}
                        type="button"
                        size="xs"
                        variant={active ? 'default' : 'outline'}
                        className={active ? 'h-7 px-2 text-xs font-semibold' : 'h-7 px-2 text-xs'}
                        onClick={() =>
                          setRecurringWeekdays((prev) =>
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
                    value={recurringStartTime}
                    onChange={(e) => setRecurringStartTime(e.target.value)}
                  />
                  <span className="self-center text-xs text-muted-foreground">~</span>
                  <Input
                    type="time"
                    value={recurringEndTime}
                    onChange={(e) => setRecurringEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-recurring-memo">메모 (선택)</Label>
                <Textarea
                  id="create-recurring-memo"
                  value={recurringMemo}
                  onChange={(e) => setRecurringMemo(e.target.value)}
                  placeholder="예: 매장 A, 주휴수당 포함 등"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !recurringTitle.trim() ||
                    !recurringStartDate ||
                    !recurringEndDate ||
                    recurringStartDate > recurringEndDate ||
                    recurringWeekdays.length === 0 ||
                    !recurringStartTime ||
                    !recurringEndTime ||
                    recurringStartTime >= recurringEndTime ||
                    createRecurringMutation.isPending
                  }
                  onClick={handleClickSaveRecurring}
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
                  value={createEventTitle}
                  onChange={(e) => setCreateEventTitle(e.target.value)}
                  placeholder="제목"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-start">시작</Label>
                <Input
                  id="create-event-start"
                  type="datetime-local"
                  value={createEventStartAt}
                  onChange={(e) => setCreateEventStartAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-end">종료</Label>
                <Input
                  id="create-event-end"
                  type="datetime-local"
                  value={createEventEndAt}
                  onChange={(e) => setCreateEventEndAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-memo">메모 (선택)</Label>
                <Textarea
                  id="create-event-memo"
                  value={createEventMemo}
                  onChange={(e) => setCreateEventMemo(e.target.value)}
                  placeholder="메모"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !createEventTitle.trim() ||
                    !createEventStartAt ||
                    !createEventEndAt ||
                    createMutation.isPending
                  }
                  onClick={() => {
                    const title = createEventTitle.trim()
                    const startAt = toApiDatetime(createEventStartAt)
                    const endAt = toApiDatetime(createEventEndAt)
                    if (!title || !startAt || !endAt) return

                    createMutation.mutate(
                      {
                        title,
                        startAt: startAt,
                        endAt: endAt,
                        memo: createEventMemo.trim() || undefined,
                      },
                      {
                        onSuccess: () => {
                          setCreateDialogOpen(false)
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
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="예: 알고리즘 문제 3개 풀기"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-todo-description">설명 (선택)</Label>
                <Textarea
                  id="create-todo-description"
                  value={todoDescription}
                  onChange={(e) => setTodoDescription(e.target.value)}
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
                  value={todoAgentRoleId}
                  onChange={(e) => setTodoAgentRoleId(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-todo-order">정렬 순서 (선택)</Label>
                <Input
                  id="create-todo-order"
                  type="number"
                  value={todoOrderIndex}
                  onChange={(e) => setTodoOrderIndex(e.target.value)}
                  placeholder="작은 숫자일수록 먼저 표시"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !todoTitle.trim() || !todoAgentRoleId.trim() || createTodoMutation.isPending
                  }
                  onClick={() => {
                    const body: TodoCreateBodyInterface = {
                      agentRoleId: Number(todoAgentRoleId),
                      title: todoTitle.trim(),
                      description: todoDescription.trim() || undefined,
                      scheduledDate: selectedDateStr,
                      orderIndex: todoOrderIndex ? Number(todoOrderIndex) : undefined,
                    }

                    if (!body.agentRoleId || Number.isNaN(body.agentRoleId)) {
                      return
                    }

                    createTodoMutation.mutate(body, {
                      onSuccess: () => {
                        setCreateDialogOpen(false)
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
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
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
              onClick={() => deleteTargetId !== null && confirmDelete(deleteTargetId)}
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
