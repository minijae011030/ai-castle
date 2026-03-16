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
  useRecurringScheduleList,
  useUpdateRecurringSchedule,
} from '@/hooks/queries/recurring-schedule-query'
import type { RecurringScheduleDataInterface } from '@/types/recurring-schedule.type'
import { useState } from 'react'

type WeekdayValue = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const weekday_options: { value: WeekdayValue; label: string }[] = [
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
  const ordered = weekday_options.filter((w) => weekdays.includes(w.value))
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

const RecurringScheduleSection = () => {
  const { data: items = [], isPending } = useRecurringScheduleList()
  const create_mutation = useCreateRecurringSchedule()
  const update_mutation = useUpdateRecurringSchedule()
  const delete_mutation = useDeleteRecurringSchedule()
  const [dialog_open, set_dialog_open] = useState(false)
  const [editing_item, set_editing_item] = useState<RecurringScheduleDataInterface | null>(null)
  const [title, set_title] = useState('')
  const [start_date, set_start_date] = useState('')
  const [end_date, set_end_date] = useState('')
  const [weekdays, set_weekdays] = useState<WeekdayValue[]>([])
  const [start_time, set_start_time] = useState('')
  const [end_time, set_end_time] = useState('')
  const [memo, set_memo] = useState('')

  const reset_form = () => {
    set_editing_item(null)
    set_title('')
    set_start_date('')
    set_end_date('')
    set_weekdays([])
    set_start_time('')
    set_end_time('')
    set_memo('')
  }

  const handle_open = () => {
    reset_form()
    set_dialog_open(true)
  }

  const handle_close = () => {
    set_dialog_open(false)
  }

  const handle_edit_open = (item: RecurringScheduleDataInterface) => {
    set_editing_item(item)
    set_title(item.title)
    set_start_date(item.periodStart)
    set_end_date(item.periodEnd)
    set_weekdays(parse_backend_weekdays(item.weekdays))
    set_start_time(item.startTime.slice(0, 5))
    set_end_time(item.endTime.slice(0, 5))
    set_memo(item.memo ?? '')
    set_dialog_open(true)
  }

  const toggle_weekday = (value: WeekdayValue) => {
    set_weekdays((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  const is_valid =
    title.trim().length > 0 &&
    start_date &&
    end_date &&
    start_date <= end_date &&
    weekdays.length > 0 &&
    start_time &&
    end_time &&
    start_time < end_time

  const handle_submit = async () => {
    if (!is_valid) return
    const payload = {
      title: title.trim(),
      periodStart: start_date,
      periodEnd: end_date,
      weekdays: to_backend_weekdays(weekdays),
      startTime: start_time,
      endTime: end_time,
      memo: memo.trim() || undefined,
    }

    if (editing_item) {
      await update_mutation.mutateAsync({
        id: editing_item.id,
        body: payload,
      })
    } else {
      await create_mutation.mutateAsync(payload)
    }
    handle_close()
  }

  const handle_delete = async (id: number) => {
    const confirmed = window.confirm(
      '이 정기 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    )
    if (!confirmed) return
    await delete_mutation.mutateAsync(id)
  }

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={handle_open}>
          + 정기 일정 추가
        </Button>
      </div>

      {isPending ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          정기 일정을 불러오는 중입니다...
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          등록된 정기 일정이 없습니다. 상단 버튼으로 새 정기 일정을 추가해 보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item: RecurringScheduleDataInterface) => (
            <Card key={item.id} size="sm">
              <CardHeader className="flex items-start justify-between gap-2 pb-2">
                <p className="text-sm font-medium">{item.title}</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="정기 일정 수정"
                    onClick={() => handle_edit_open(item)}
                  >
                    ✎
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="정기 일정 삭제"
                    onClick={() => handle_delete(item.id)}
                    disabled={delete_mutation.isPending}
                  >
                    🗑
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
      )}

      <Dialog open={dialog_open} onOpenChange={(open) => !open && handle_close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing_item ? '정기 일정 수정' : '정기 일정 추가'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="recurring-title">제목</Label>
              <Input
                id="recurring-title"
                value={title}
                onChange={(e) => set_title(e.target.value)}
                placeholder="예: 알바"
              />
            </div>
            <div className="grid gap-2">
              <Label>기간 (필수)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={start_date}
                  onChange={(e) => set_start_date(e.target.value)}
                />
                <span className="self-center text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  value={end_date}
                  onChange={(e) => set_end_date(e.target.value)}
                />
              </div>
              {start_date && end_date && start_date > end_date && (
                <p className="text-xs text-destructive">
                  시작일은 종료일보다 빠르거나 같아야 합니다.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>요일 (최소 1개)</Label>
              <div className="flex flex-wrap gap-1.5">
                {weekday_options.map((opt) => {
                  const active = weekdays.includes(opt.value)
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      size="xs"
                      variant={active ? 'default' : 'outline'}
                      className={cn('h-7 px-2 text-xs', active && 'font-semibold')}
                      onClick={() => toggle_weekday(opt.value)}
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
                  value={start_time}
                  onChange={(e) => set_start_time(e.target.value)}
                />
                <span className="self-center text-xs text-muted-foreground">~</span>
                <Input
                  type="time"
                  value={end_time}
                  onChange={(e) => set_end_time(e.target.value)}
                />
              </div>
              {start_time && end_time && start_time >= end_time && (
                <p className="text-xs text-destructive">시작 시간은 종료 시간보다 빨라야 합니다.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-memo">메모 (선택)</Label>
              <Textarea
                id="recurring-memo"
                value={memo}
                onChange={(e) => set_memo(e.target.value)}
                placeholder="예: 매장 A, 주휴수당 포함 등"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={handle_close}>
              취소
            </Button>
            <Button type="button" size="sm" onClick={handle_submit} disabled={!is_valid}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { RecurringScheduleSection }
