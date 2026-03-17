import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import {
  useCreateRecurringSchedule,
  useDeleteRecurringSchedule,
  useUpdateRecurringSchedule,
} from '@/hooks/queries/recurring-schedule-query'
import type { RecurringScheduleDataInterface } from '@/types/recurring-schedule.type'
import { useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2Icon, CircleIcon, PencilIcon, Trash2Icon } from 'lucide-react'

type WeekdayValue = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const weekdayOptions: { value: WeekdayValue; label: string }[] = [
  { value: 'mon', label: '월' },
  { value: 'tue', label: '화' },
  { value: 'wed', label: '수' },
  { value: 'thu', label: '목' },
  { value: 'fri', label: '금' },
  { value: 'sat', label: '토' },
  { value: 'sun', label: '일' },
]

const format_weekdays = (weekdays: WeekdayValue[]): string => {
  if (weekdays.length === 0) return ''
  const ordered = weekdayOptions.filter((w) => weekdays.includes(w.value))
  return ordered.map((w) => w.label).join(',')
}

const to_backend_weekdays = (weekdays: WeekdayValue[]): string => {
  const map: Record<WeekdayValue, string> = {
    mon: 'MON',
    tue: 'TUE',
    wed: 'WED',
    thu: 'THU',
    fri: 'FRI',
    sat: 'SAT',
    sun: 'SUN',
  }
  return weekdays.map((w) => map[w]).join(',')
}

const parse_backend_weekdays = (weekdays: string): WeekdayValue[] => {
  if (!weekdays) return []
  const map: Record<string, WeekdayValue> = {
    MON: 'mon',
    TUE: 'tue',
    WED: 'wed',
    THU: 'thu',
    FRI: 'fri',
    SAT: 'sat',
    SUN: 'sun',
  }
  return weekdays
    .split(',')
    .map((s) => s.trim())
    .map((code) => map[code])
    .filter((v): v is WeekdayValue => !!v)
}

interface RecurringScheduleSectionPropsInterface {
  selectedDate: Date
  recurringSchedules: RecurringScheduleDataInterface[]
  isPending: boolean
  /** 해당 날짜에서 사용자가 완료 처리한 정기 일정 ID 목록 */
  completedRecurringIds: number[]
  /** 정기 일정 완료 토글 클릭 시 호출되는 콜백 */
  onToggleCompleted: (id: number) => void
}

export const RecurringScheduleSection = ({
  selectedDate,
  recurringSchedules,
  isPending,
  completedRecurringIds,
  onToggleCompleted,
}: RecurringScheduleSectionPropsInterface) => {
  const createMutation = useCreateRecurringSchedule()
  const updateMutation = useUpdateRecurringSchedule()
  const deleteMutation = useDeleteRecurringSchedule()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringScheduleDataInterface | null>(null)

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekdays, setWeekdays] = useState<WeekdayValue[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [memo, setMemo] = useState('')

  const handleClose = () => {
    setDialogOpen(false)
  }

  const handleEditOpen = (item: RecurringScheduleDataInterface) => {
    setEditingItem(item)
    setTitle(item.title)
    setStartDate(item.periodStart)
    setEndDate(item.periodEnd)
    setWeekdays(parse_backend_weekdays(item.weekdays))
    setStartTime(item.startTime.slice(0, 5))
    setEndTime(item.endTime.slice(0, 5))
    setMemo(item.memo ?? '')
    setDialogOpen(true)
  }

  const toggleWeekday = (value: WeekdayValue) => {
    setWeekdays((prev) =>
      prev.includes(value) ? prev.filter((v: WeekdayValue) => v !== value) : [...prev, value],
    )
  }

  const is_valid =
    title.trim().length > 0 &&
    startDate &&
    endDate &&
    startDate <= endDate &&
    weekdays.length > 0 &&
    startTime &&
    endTime &&
    startTime < endTime

  const handleSubmit = async () => {
    if (!is_valid) return
    const payload = {
      title: title.trim(),
      periodStart: startDate,
      periodEnd: endDate,
      weekdays: to_backend_weekdays(weekdays),
      startTime: startTime,
      endTime: endTime,
      memo: memo.trim() || undefined,
    }

    if (editingItem) {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        body: payload,
      })
    } else {
      await createMutation.mutateAsync(payload)
    }
    handleClose()
  }

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
      '이 정기 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    )
    if (!confirmed) return
    await deleteMutation.mutateAsync(id)
  }

  // 선택된 날짜 기준으로 실제 해당되는 정기 일정만 필터링
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const weekdayByIndex: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const selectedWeekdayCode = weekdayByIndex[selectedDate.getDay()]

  const itemsForSelected = recurringSchedules.filter((item) => {
    const inPeriod = item.periodStart <= selectedDateStr && selectedDateStr <= item.periodEnd
    if (!inPeriod) return false

    if (!selectedWeekdayCode) return false

    const weekdayTokens = item.weekdays
      .split(',')
      .map((s) => s.trim())
      .map((s: string) => s.trim())
      .filter(Boolean)

    return weekdayTokens.includes(selectedWeekdayCode)
  })

  if (isPending || itemsForSelected.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <ul className="flex flex-col gap-2">
        {itemsForSelected.map((item: RecurringScheduleDataInterface) => (
          <Card key={item.id} size="sm">
            <CardHeader className="flex items-start justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="정기 일정 완료 토글"
                  onClick={() => onToggleCompleted(item.id)}
                >
                  {completedRecurringIds.includes(item.id) ? (
                    <CheckCircle2Icon className="size-4 text-primary" />
                  ) : (
                    <CircleIcon className="size-4 text-muted-foreground" />
                  )}
                </Button>
                <p
                  className={cn(
                    'text-sm font-medium',
                    completedRecurringIds.includes(item.id) && 'text-muted-foreground line-through',
                  )}
                >
                  {item.title}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="정기 일정 수정"
                  onClick={() => handleEditOpen(item)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="정기 일정 삭제"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">기간</span> {item.periodStart} ~{' '}
                {item.periodEnd}
              </p>
              <p>
                <span className="font-medium text-foreground">요일</span>{' '}
                {format_weekdays(parse_backend_weekdays(item.weekdays))}
              </p>
              <p>
                <span className="font-medium text-foreground">시간</span>{' '}
                {item.startTime.slice(0, 5)} ~ {item.endTime.slice(0, 5)}
              </p>
              {item.memo && <p className="line-clamp-2">{item.memo}</p>}
            </CardContent>
          </Card>
        ))}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? '정기 일정 수정' : '정기 일정 추가'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="recurring-title">제목</Label>
              <Input
                id="recurring-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 알바"
              />
            </div>
            <div className="grid gap-2">
              <Label>기간 (필수)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="self-center text-xs text-muted-foreground">~</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {startDate && endDate && startDate > endDate && (
                <p className="text-xs text-destructive">
                  시작일은 종료일보다 빠르거나 같아야 합니다.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>요일 (최소 1개)</Label>
              <div className="flex flex-wrap gap-1.5">
                {weekdayOptions.map((opt) => {
                  const active = weekdays.includes(opt.value)
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      size="xs"
                      variant={active ? 'default' : 'outline'}
                      className={cn('h-7 px-2 text-xs', active && 'font-semibold')}
                      onClick={() => toggleWeekday(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  )
                })}
              </div>
              {weekdays.length === 0 && (
                <p className="text-xs text-destructive">최소 한 개 이상의 요일을 선택해 주세요.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>시간 (필수)</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <span className="self-center text-xs text-muted-foreground">~</span>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              {startTime && endTime && startTime >= endTime && (
                <p className="text-xs text-destructive">시작 시간은 종료 시간보다 빨라야 합니다.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-memo">메모 (선택)</Label>
              <Textarea
                id="recurring-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 매장 A, 주휴수당 포함 등"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              취소
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={!is_valid}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
