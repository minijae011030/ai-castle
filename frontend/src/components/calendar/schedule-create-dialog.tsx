import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useActiveAgentList } from '@/hooks/queries/agent-query'
import { useCreateSchedule, useCreateScheduleRange } from '@/hooks/queries/schedule-query'
import { useCreateRecurringScheduleTemplate } from '@/hooks/queries/recurring-schedule-template-query'
import type { ScheduleType } from '@/types/schedule.type'
import { useForm, useController } from 'react-hook-form'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ActiveTab = 'recurring' | 'event' | 'todo'

interface ScheduleCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDateStr: string
  trigger: ReactNode
}

interface ScheduleCreateFormValues {
  // 정기일정
  recurringTitle: string
  recurringDescription: string
  recurringStartTime: string
  recurringEndTime: string
  recurringWeekdays: string[]
  recurringPeriodStartDate: string
  recurringPeriodEndDate: string
  // 단일 일정/할일
  singleTitle: string
  singleDescription: string
  singleStartDate: string
  singleEndDate: string
  singleStartTime: string
  singleEndTime: string
  singleAllDay: boolean
  todoAgentId: string
}

export const ScheduleCreateDialog = ({
  open,
  onOpenChange,
  selectedDateStr,
  trigger,
}: ScheduleCreateDialogProps) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('event')
  const createScheduleMutation = useCreateSchedule()
  const createScheduleRangeMutation = useCreateScheduleRange()
  const createRecurringTemplateMutation = useCreateRecurringScheduleTemplate()
  const { data: activeAgents = [], isPending: isActiveAgentsPending } = useActiveAgentList()

  const { control, handleSubmit, reset } = useForm<ScheduleCreateFormValues>({
    defaultValues: {
      recurringTitle: '',
      recurringDescription: '',
      recurringStartTime: '07:00',
      recurringEndTime: '08:00',
      recurringWeekdays: ['MON'],
      recurringPeriodStartDate: '',
      recurringPeriodEndDate: '',
      singleTitle: '',
      singleDescription: '',
      singleStartDate: '',
      singleEndDate: '',
      singleStartTime: '09:00',
      singleEndTime: '10:00',
      singleAllDay: false,
      todoAgentId: '',
    },
  })

  const { field: recurringTitleField } = useController({
    name: 'recurringTitle',
    control,
  })
  const { field: recurringDescriptionField } = useController({
    name: 'recurringDescription',
    control,
  })
  const { field: recurringStartTimeField } = useController({
    name: 'recurringStartTime',
    control,
  })
  const { field: recurringEndTimeField } = useController({
    name: 'recurringEndTime',
    control,
  })
  const { field: recurringWeekdaysField } = useController({
    name: 'recurringWeekdays',
    control,
  })
  const { field: recurringPeriodStartDateField } = useController({
    name: 'recurringPeriodStartDate',
    control,
  })
  const { field: recurringPeriodEndDateField } = useController({
    name: 'recurringPeriodEndDate',
    control,
  })

  const { field: singleTitleField } = useController({
    name: 'singleTitle',
    control,
  })
  const { field: singleDescriptionField } = useController({
    name: 'singleDescription',
    control,
  })
  const { field: singleStartDateField } = useController({
    name: 'singleStartDate',
    control,
  })
  const { field: singleEndDateField } = useController({
    name: 'singleEndDate',
    control,
  })
  const { field: singleStartTimeField } = useController({
    name: 'singleStartTime',
    control,
  })
  const { field: singleEndTimeField } = useController({
    name: 'singleEndTime',
    control,
  })
  const { field: singleAllDayField } = useController({
    name: 'singleAllDay',
    control,
  })
  const { field: todoAgentIdField } = useController({
    name: 'todoAgentId',
    control,
  })

  const closeAndReset = () => {
    onOpenChange(false)
    reset()
    setActiveTab('event')
  }

  const handleCreateRecurring = (values: ScheduleCreateFormValues) => {
    if (!values.recurringTitle.trim()) return

    const period_start = values.recurringPeriodStartDate || selectedDateStr
    const period_end = values.recurringPeriodEndDate || selectedDateStr
    const repeat_weekdays = values.recurringWeekdays.join(',')

    createRecurringTemplateMutation.mutate({
      title: values.recurringTitle.trim(),
      description: values.recurringDescription.trim() || undefined,
      periodStartDate: period_start,
      periodEndDate: period_end,
      repeatWeekdays: repeat_weekdays,
      startTime: `${values.recurringStartTime}:00`,
      endTime: `${values.recurringEndTime}:00`,
    })

    closeAndReset()
  }

  const createSingleRange = (type: ScheduleType, values: ScheduleCreateFormValues) => {
    if (!values.singleTitle.trim()) return

    const start_date_str = values.singleStartDate || selectedDateStr
    const end_date_str = values.singleEndDate || values.singleStartDate || selectedDateStr

    const agent_id =
      type === 'TODO' && values.todoAgentId.trim()
        ? Number.parseInt(values.todoAgentId.trim(), 10)
        : undefined

    // 단일 날짜면 기존 단일 생성 API 사용, 기간이면 range API 사용(한 번의 요청)
    if (start_date_str === end_date_str) {
      const start_time = values.singleAllDay ? '00:00' : values.singleStartTime
      const end_time = values.singleAllDay ? '00:00' : values.singleEndTime
      const start_at = `${start_date_str}T${start_time}:00`
      const end_at = `${end_date_str}T${end_time}:00`

      createScheduleMutation.mutate({
        type,
        title: values.singleTitle.trim(),
        description: values.singleDescription.trim() || undefined,
        occurrenceDate: start_date_str,
        startAt: start_at,
        endAt: end_at,
        agentId: agent_id,
      })
    } else {
      if (type === 'RECURRING_OCCURRENCE') return
      createScheduleRangeMutation.mutate({
        type: type as 'CALENDAR_EVENT' | 'TODO',
        title: values.singleTitle.trim(),
        description: values.singleDescription.trim() || undefined,
        startDate: start_date_str,
        endDate: end_date_str,
        startTime: `${values.singleAllDay ? '00:00' : values.singleStartTime}:00`,
        endTime: `${values.singleAllDay ? '00:00' : values.singleEndTime}:00`,
        agentId: agent_id,
      })
    }

    closeAndReset()
  }

  const onSubmit = (values: ScheduleCreateFormValues) => {
    if (activeTab === 'recurring') {
      handleCreateRecurring(values)
    } else if (activeTab === 'event') {
      createSingleRange('CALENDAR_EVENT', values)
    } else {
      createSingleRange('TODO', values)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스케줄 추가</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList className="mb-3">
            <TabsTrigger value="recurring">정기일정</TabsTrigger>
            <TabsTrigger value="event">일정</TabsTrigger>
            <TabsTrigger value="todo">할일</TabsTrigger>
          </TabsList>
          <TabsContent value="recurring" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-title">제목</Label>
              <Input id="recurring-title" {...recurringTitleField} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-description">설명</Label>
              <Textarea id="recurring-description" {...recurringDescriptionField} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="recurring-start-time">시작 시간</Label>
                <Input id="recurring-start-time" type="time" {...recurringStartTimeField} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recurring-end-time">종료 시간</Label>
                <Input id="recurring-end-time" type="time" {...recurringEndTimeField} />
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
                  const checked = (recurringWeekdaysField.value ?? []).includes(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const prev: string[] = recurringWeekdaysField.value ?? []
                        recurringWeekdaysField.onChange(
                          prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
                        )
                      }}
                      className={cn(
                        'rounded-full border px-2 py-0.5',
                        checked
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background text-foreground/80',
                      )}
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
                <Input id="recurring-period-start" type="date" {...recurringPeriodStartDateField} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recurring-period-end">기간 종료</Label>
                <Input id="recurring-period-end" type="date" {...recurringPeriodEndDateField} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="event" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="single-title-event">제목</Label>
              <Input id="single-title-event" {...singleTitleField} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="single-description-event">설명</Label>
              <Textarea id="single-description-event" {...singleDescriptionField} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="single-start-date-event">시작 날짜</Label>
                <Input
                  id="single-start-date-event"
                  type="date"
                  value={singleStartDateField.value || selectedDateStr}
                  onChange={(e) => singleStartDateField.onChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-date-event">종료 날짜</Label>
                <Input
                  id="single-end-date-event"
                  type="date"
                  value={singleEndDateField.value || singleStartDateField.value || selectedDateStr}
                  onChange={(e) => singleEndDateField.onChange(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="single-start-time-event">시작 시간</Label>
                <Input
                  id="single-start-time-event"
                  type="time"
                  {...singleStartTimeField}
                  disabled={singleAllDayField.value}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-time-event">종료 시간</Label>
                <Input
                  id="single-end-time-event"
                  type="time"
                  {...singleEndTimeField}
                  disabled={singleAllDayField.value}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(singleAllDayField.value)}
                onChange={(event) => singleAllDayField.onChange(event.target.checked)}
              />
              종일
            </label>
          </TabsContent>
          <TabsContent value="todo" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="single-title-todo">제목</Label>
              <Input id="single-title-todo" {...singleTitleField} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="single-description-todo">설명</Label>
              <Textarea id="single-description-todo" {...singleDescriptionField} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="todo-agent-id">에이전트</Label>
              <Select
                value={todoAgentIdField.value ?? ''}
                onValueChange={(v) => todoAgentIdField.onChange(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={isActiveAgentsPending ? '불러오는 중...' : '에이전트를 선택하세요'}
                  />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="__none__">선택 안함</SelectItem>
                  {activeAgents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="single-start-date-todo">시작 날짜</Label>
                <Input
                  id="single-start-date-todo"
                  type="date"
                  value={singleStartDateField.value || selectedDateStr}
                  onChange={(e) => singleStartDateField.onChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-date-todo">종료 날짜</Label>
                <Input
                  id="single-end-date-todo"
                  type="date"
                  value={singleEndDateField.value || singleStartDateField.value || selectedDateStr}
                  onChange={(e) => singleEndDateField.onChange(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="single-start-time-todo">시작 시간</Label>
                <Input
                  id="single-start-time-todo"
                  type="time"
                  {...singleStartTimeField}
                  disabled={singleAllDayField.value}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-time-todo">종료 시간</Label>
                <Input
                  id="single-end-time-todo"
                  type="time"
                  {...singleEndTimeField}
                  disabled={singleAllDayField.value}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(singleAllDayField.value)}
                onChange={(event) => singleAllDayField.onChange(event.target.checked)}
              />
              종일
            </label>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          {activeTab === 'recurring' && (
            <Button type="button" onClick={handleSubmit(onSubmit)}>
              정기일정 추가
            </Button>
          )}
          {activeTab === 'event' && (
            <Button type="button" onClick={handleSubmit(onSubmit)}>
              일정 추가
            </Button>
          )}
          {activeTab === 'todo' && (
            <Button type="button" onClick={handleSubmit(onSubmit)}>
              할일 추가
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
