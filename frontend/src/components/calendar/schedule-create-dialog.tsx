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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useCreateSchedule } from '@/hooks/queries/schedule-query'
import { useCreateRecurringScheduleTemplate } from '@/hooks/queries/recurring-schedule-template-query'
import type { ScheduleType } from '@/types/schedule.type'
import { format } from 'date-fns'
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
  const createRecurringTemplateMutation = useCreateRecurringScheduleTemplate()

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

    const start_date = new Date(start_date_str)
    const end_date = new Date(end_date_str)

    if (Number.isNaN(start_date.getTime()) || Number.isNaN(end_date.getTime())) return
    if (end_date < start_date) return

    const agent_id =
      type === 'TODO' && values.todoAgentId.trim()
        ? Number.parseInt(values.todoAgentId.trim(), 10)
        : undefined

    for (
      let d = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
      d <= end_date;
      d.setDate(d.getDate() + 1)
    ) {
      const date_str = format(d, 'yyyy-MM-dd')
      const start_at = `${date_str}T${values.singleStartTime}:00`
      const end_at = `${date_str}T${values.singleEndTime}:00`

      createScheduleMutation.mutate({
        type,
        title: values.singleTitle.trim(),
        description: values.singleDescription.trim() || undefined,
        occurrenceDate: date_str,
        startAt: start_at,
        endAt: end_at,
        calendarEventId: type === 'CALENDAR_EVENT' ? 0 : undefined,
        todoId: type === 'TODO' ? 0 : undefined,
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
                        'rounded-full border px-2 py-0.5 ' + checked
                          ? 'bg-primary text-primary-foreground border-primary'
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
                <Input id="single-start-time-event" type="time" {...singleStartTimeField} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-time-event">종료 시간</Label>
                <Input id="single-end-time-event" type="time" {...singleEndTimeField} />
              </div>
            </div>
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
              <Label htmlFor="todo-agent-id">에이전트 ID (숫자)</Label>
              <Input id="todo-agent-id" type="number" inputMode="numeric" {...todoAgentIdField} />
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
                <Input id="single-start-time-todo" type="time" {...singleStartTimeField} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="single-end-time-todo">종료 시간</Label>
                <Input id="single-end-time-todo" type="time" {...singleEndTimeField} />
              </div>
            </div>
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
