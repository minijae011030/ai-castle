import { ko } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import {
  useSchedulesByDay,
  useSchedulesByMonth,
  useToggleScheduleDone,
  useToggleRecurringScheduleDone,
  useCreateSchedule,
} from '@/hooks/queries/schedule-query'
import { format } from 'date-fns'
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell'
import type { ScheduleOccurrenceInterface, ScheduleType } from '@/types/schedule.type'
import { Badge } from '@/components/ui/badge'
import {
  useCreateRecurringScheduleTemplate,
  useRecurringScheduleTemplateList,
} from '@/hooks/queries/recurring-schedule-template-query'
import type { RecurringScheduleTemplateInterface } from '@/types/recurring-schedule-template.type'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'recurring' | 'event' | 'todo'>('event')

  // 정기일정 폼 상태
  const [recurringTitle, setRecurringTitle] = useState('')
  const [recurringDescription, setRecurringDescription] = useState('')
  const [recurringStartTime, setRecurringStartTime] = useState('07:00')
  const [recurringEndTime, setRecurringEndTime] = useState('08:00')
  const [recurringWeekdays, setRecurringWeekdays] = useState<string[]>(['MON'])
  const [recurringPeriodStartDate, setRecurringPeriodStartDate] = useState('')
  const [recurringPeriodEndDate, setRecurringPeriodEndDate] = useState('')

  // 일정/할일 공통 폼 상태
  const [singleTitle, setSingleTitle] = useState('')
  const [singleDescription, setSingleDescription] = useState('')
  const [singleStartTime, setSingleStartTime] = useState('09:00')
  const [singleEndTime, setSingleEndTime] = useState('10:00')
  const [singleStartDate, setSingleStartDate] = useState('')
  const [singleEndDate, setSingleEndDate] = useState('')
  const [todoAgentId, setTodoAgentId] = useState<string>('')

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data: schedulesByDay, isPending } = useSchedulesByDay(selectedDateStr)

  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth() + 1
  const { data: schedulesByMonth } = useSchedulesByMonth(year, month)

  const { data: recurringTemplates = [] } = useRecurringScheduleTemplateList()
  const createScheduleMutation = useCreateSchedule()
  const createRecurringTemplateMutation = useCreateRecurringScheduleTemplate()

  const schedulesFromTemplates: ScheduleOccurrenceInterface[] = useMemo(() => {
    if (!recurringTemplates) return []

    const result: ScheduleOccurrenceInterface[] = []
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)

    const weekdayByIndex: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    for (const t of recurringTemplates as RecurringScheduleTemplateInterface[]) {
      const periodStart = new Date(t.periodStartDate)
      const periodEnd = new Date(t.periodEndDate)

      const iterStart = startOfMonth < periodStart ? periodStart : startOfMonth
      const iterEnd = endOfMonth > periodEnd ? periodEnd : endOfMonth

      for (let d = new Date(iterStart.getTime()); d <= iterEnd; d.setDate(d.getDate() + 1)) {
        const weekdayCode = weekdayByIndex[d.getDay()]
        const tokens = t.repeatWeekdays
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

        if (!tokens.includes(weekdayCode)) continue

        const dateStr = format(d, 'yyyy-MM-dd')

        result.push({
          id: Number(`${t.id}${format(d, 'dd')}`),
          title: t.title,
          description: t.description,
          done: false,
          type: 'RECURRING_OCCURRENCE',
          occurrenceDate: dateStr,
          startAt: `${dateStr}T${t.startTime}`,
          endAt: `${dateStr}T${t.endTime}`,
          recurringTemplateId: t.id,
          calendarEventId: null,
          todoId: null,
        })
      }
    }

    return result
  }, [month, recurringTemplates, year])

  const templatesByDateMap = useMemo(() => {
    const map: Record<string, ScheduleOccurrenceInterface[]> = {}
    for (const s of schedulesFromTemplates) {
      const key = s.occurrenceDate
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [schedulesFromTemplates])

  const schedulesByDateMap = useMemo(() => {
    const map: Record<string, ScheduleOccurrenceInterface[]> = {}

    const existingRecurringKeys = new Set(
      (schedulesByMonth ?? [])
        .filter(
          (s) =>
            s.type === 'RECURRING_OCCURRENCE' && s.recurringTemplateId !== null && s.occurrenceDate,
        )
        .map((s) => `${s.recurringTemplateId}-${s.occurrenceDate}`),
    )

    const all: ScheduleOccurrenceInterface[] = [...(schedulesByMonth ?? [])]

    for (const s of schedulesFromTemplates) {
      const key = `${s.recurringTemplateId}-${s.occurrenceDate}`
      if (s.recurringTemplateId && !existingRecurringKeys.has(key)) {
        all.push(s)
      }
    }

    for (const s of all) {
      const dateKey = s.occurrenceDate
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(s)
    }

    return map
  }, [schedulesByMonth, schedulesFromTemplates])

  const schedulesForSelectedDay = useMemo(() => {
    const fromApi = schedulesByDay ?? []
    const fromTemplates = templatesByDateMap[selectedDateStr] ?? []

    const existingRecurringKeys = new Set(
      fromApi
        .filter(
          (s) =>
            s.type === 'RECURRING_OCCURRENCE' &&
            s.recurringTemplateId !== null &&
            s.occurrenceDate === selectedDateStr,
        )
        .map((s) => `${s.recurringTemplateId}-${s.occurrenceDate}`),
    )

    const filteredTemplates = fromTemplates.filter((s) => {
      if (!s.recurringTemplateId) return true
      const key = `${s.recurringTemplateId}-${s.occurrenceDate}`
      return !existingRecurringKeys.has(key)
    })

    return [...fromApi, ...filteredTemplates].sort((a, b) => a.startAt.localeCompare(b.startAt))
  }, [schedulesByDay, selectedDateStr, templatesByDateMap])

  const toggleScheduleDoneMutation = useToggleScheduleDone()
  const toggleRecurringDoneMutation = useToggleRecurringScheduleDone()

  const resetFormState = () => {
    setRecurringTitle('')
    setRecurringDescription('')
    setRecurringStartTime('07:00')
    setRecurringEndTime('08:00')
    setRecurringWeekdays(['MON'])
    setRecurringPeriodStartDate('')
    setRecurringPeriodEndDate('')
    setSingleTitle('')
    setSingleDescription('')
    setSingleStartTime('09:00')
    setSingleEndTime('10:00')
    setSingleStartDate('')
    setSingleEndDate('')
    setTodoAgentId('')
    setActiveTab('event')
  }

  const handleCreateSingleSchedule = (type: ScheduleType) => {
    // type 에 따라 calendarEvent / todo 를 구분해서 생성
    if (!singleTitle.trim()) {
      // 제목 필수
      return
    }

    // 시작/종료 날짜가 비어있으면 현재 선택된 날짜를 기본값으로 사용
    const start_date_str = singleStartDate || selectedDateStr
    const end_date_str = singleEndDate || singleStartDate || selectedDateStr

    const start_date = new Date(start_date_str)
    const end_date = new Date(end_date_str)

    if (Number.isNaN(start_date.getTime()) || Number.isNaN(end_date.getTime())) {
      // 날짜 파싱 실패 시 그냥 리턴
      return
    }

    if (end_date < start_date) {
      // 종료 날짜가 시작 날짜보다 빠르면 리턴
      return
    }

    const agent_id =
      type === 'TODO' && todoAgentId.trim() ? Number.parseInt(todoAgentId.trim(), 10) : undefined

    // 여러 날짜 범위를 한 번에 생성
    for (
      let d = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
      d <= end_date;
      d.setDate(d.getDate() + 1)
    ) {
      const date_str = format(d, 'yyyy-MM-dd')
      const start_at = `${date_str}T${singleStartTime}:00`
      const end_at = `${date_str}T${singleEndTime}:00`

      createScheduleMutation.mutate({
        type,
        title: singleTitle.trim(),
        description: singleDescription.trim() || undefined,
        occurrenceDate: date_str,
        startAt: start_at,
        endAt: end_at,
        calendarEventId: type === 'CALENDAR_EVENT' ? 0 : undefined,
        todoId: type === 'TODO' ? 0 : undefined,
        agentId: agent_id,
      })
    }

    setCreateDialogOpen(false)
    resetFormState()
  }

  const handleCreateRecurringTemplate = () => {
    if (!recurringTitle.trim()) {
      return
    }

    const period_start = recurringPeriodStartDate || selectedDateStr
    const period_end = recurringPeriodEndDate || selectedDateStr

    const repeat_weekdays = recurringWeekdays.join(',')

    createRecurringTemplateMutation.mutate({
      title: recurringTitle.trim(),
      description: recurringDescription.trim() || undefined,
      periodStartDate: period_start,
      periodEndDate: period_end,
      repeatWeekdays: repeat_weekdays,
      startTime: `${recurringStartTime}:00`,
      endTime: `${recurringEndTime}:00`,
    })

    setCreateDialogOpen(false)
    resetFormState()
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-2xl shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (!d) return
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
                schedules={schedulesByDateMap[format(props.day.date, 'yyyy-MM-dd')] ?? []}
                {...props}
              />
            ),
          }}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                + 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>스케줄 추가</DialogTitle>
              </DialogHeader>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'recurring' | 'event' | 'todo')}
              >
                <TabsList className="mb-3">
                  <TabsTrigger value="recurring">정기일정</TabsTrigger>
                  <TabsTrigger value="event">일정</TabsTrigger>
                  <TabsTrigger value="todo">할일</TabsTrigger>
                </TabsList>
                <TabsContent value="recurring" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="recurring-title">제목</Label>
                    <Input
                      id="recurring-title"
                      value={recurringTitle}
                      onChange={(e) => setRecurringTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recurring-description">설명</Label>
                    <Textarea
                      id="recurring-description"
                      value={recurringDescription}
                      onChange={(e) => setRecurringDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring-start-time">시작 시간</Label>
                      <Input
                        id="recurring-start-time"
                        type="time"
                        value={recurringStartTime}
                        onChange={(e) => setRecurringStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring-end-time">종료 시간</Label>
                      <Input
                        id="recurring-end-time"
                        type="time"
                        value={recurringEndTime}
                        onChange={(e) => setRecurringEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>반복 요일</Label>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {[
                        ['MON', '월'],
                        ['TUE', '화'],
                        ['WED', '수'],
                        ['THU', '목'],
                        ['FRI', '금'],
                        ['SAT', '토'],
                        ['SUN', '일'],
                      ].map(([code, label]) => {
                        const checked = recurringWeekdays.includes(code)
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setRecurringWeekdays((prev) =>
                                prev.includes(code)
                                  ? prev.filter((x) => x !== code)
                                  : [...prev, code],
                              )
                            }}
                            className={
                              'rounded-full border px-2 py-0.5 ' +
                              (checked
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground/80')
                            }
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring-period-start">기간 시작</Label>
                      <Input
                        id="recurring-period-start"
                        type="date"
                        value={recurringPeriodStartDate}
                        onChange={(e) => setRecurringPeriodStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring-period-end">기간 종료</Label>
                      <Input
                        id="recurring-period-end"
                        type="date"
                        value={recurringPeriodEndDate}
                        onChange={(e) => setRecurringPeriodEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="event" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="single-title-event">제목</Label>
                    <Input
                      id="single-title-event"
                      value={singleTitle}
                      onChange={(e) => setSingleTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="single-description-event">설명</Label>
                    <Textarea
                      id="single-description-event"
                      value={singleDescription}
                      onChange={(e) => setSingleDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="single-start-date-event">시작 날짜</Label>
                      <Input
                        id="single-start-date-event"
                        type="date"
                        value={singleStartDate || selectedDateStr}
                        onChange={(e) => setSingleStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="single-end-date-event">종료 날짜</Label>
                      <Input
                        id="single-end-date-event"
                        type="date"
                        value={singleEndDate || singleStartDate || selectedDateStr}
                        onChange={(e) => setSingleEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="single-start-time-event">시작 시간</Label>
                      <Input
                        id="single-start-time-event"
                        type="time"
                        value={singleStartTime}
                        onChange={(e) => setSingleStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="single-end-time-event">종료 시간</Label>
                      <Input
                        id="single-end-time-event"
                        type="time"
                        value={singleEndTime}
                        onChange={(e) => setSingleEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="todo" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="single-title-todo">제목</Label>
                    <Input
                      id="single-title-todo"
                      value={singleTitle}
                      onChange={(e) => setSingleTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="single-description-todo">설명</Label>
                    <Textarea
                      id="single-description-todo"
                      value={singleDescription}
                      onChange={(e) => setSingleDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="todo-agent-id">에이전트 ID (숫자)</Label>
                    <Input
                      id="todo-agent-id"
                      type="number"
                      inputMode="numeric"
                      value={todoAgentId}
                      onChange={(e) => setTodoAgentId(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="single-start-date-todo">시작 날짜</Label>
                      <Input
                        id="single-start-date-todo"
                        type="date"
                        value={singleStartDate || selectedDateStr}
                        onChange={(e) => setSingleStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="single-end-date-todo">종료 날짜</Label>
                      <Input
                        id="single-end-date-todo"
                        type="date"
                        value={singleEndDate || singleStartDate || selectedDateStr}
                        onChange={(e) => setSingleEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="single-start-time-todo">시작 시간</Label>
                      <Input
                        id="single-start-time-todo"
                        type="time"
                        value={singleStartTime}
                        onChange={(e) => setSingleStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="single-end-time-todo">종료 시간</Label>
                      <Input
                        id="single-end-time-todo"
                        type="time"
                        value={singleEndTime}
                        onChange={(e) => setSingleEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                {activeTab === 'recurring' && (
                  <Button type="button" onClick={handleCreateRecurringTemplate}>
                    정기일정 추가
                  </Button>
                )}
                {activeTab === 'event' && (
                  <Button
                    type="button"
                    onClick={() => handleCreateSingleSchedule('CALENDAR_EVENT')}
                  >
                    일정 추가
                  </Button>
                )}
                {activeTab === 'todo' && (
                  <Button type="button" onClick={() => handleCreateSingleSchedule('TODO')}>
                    할일 추가
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-1 text-xs">
          {isPending && <p className="text-muted-foreground">불러오는 중...</p>}
          {!isPending && schedulesForSelectedDay.length === 0 && (
            <p className="text-muted-foreground">이 날짜에는 스케줄이 없습니다.</p>
          )}
          {!isPending &&
            schedulesForSelectedDay.map((s) => {
              const isDone = s.done
              const isRecurring =
                s.type === 'RECURRING_OCCURRENCE' && s.recurringTemplateId !== null
              return (
                <button
                  key={`${s.type}-${s.recurringTemplateId ?? s.calendarEventId ?? s.todoId ?? s.id}`}
                  type="button"
                  onClick={() => {
                    if (isRecurring && s.recurringTemplateId) {
                      toggleRecurringDoneMutation.mutate({
                        templateId: s.recurringTemplateId,
                        date: s.occurrenceDate,
                      })
                    } else {
                      toggleScheduleDoneMutation.mutate({ id: s.id })
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-accent/60"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        'inline-flex size-4 items-center justify-center rounded-full border text-[10px] ' +
                        (isDone
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground')
                      }
                    >
                      {isDone ? '✓' : ''}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p
                        className={
                          'truncate font-medium ' +
                          (isDone ? 'text-muted-foreground line-through' : 'text-foreground')
                        }
                      >
                        {s.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(s.startAt), 'HH:mm')} ~{' '}
                        {format(new Date(s.endAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                    {s.type === 'RECURRING_OCCURRENCE'
                      ? '정기'
                      : s.type === 'CALENDAR_EVENT'
                        ? '일정'
                        : '할 일'}
                  </Badge>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
