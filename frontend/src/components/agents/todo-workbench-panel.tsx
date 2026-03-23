import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'

type TodoWorkbenchDateFilterType = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'

interface TodoWorkbenchPanelPropsInterface {
  todoWorkbenchFilter: TodoWorkbenchDateFilterType
  selectedWorkbenchTodoIds: number[]
  workbenchTodos: ScheduleOccurrenceInterface[]
  isMonthlySchedulesPending: boolean
  adjustRequestMessage: string
  adjustRequestDeadlineDate: string
  isSendPending: boolean
  onChangeFilter: (filter: TodoWorkbenchDateFilterType) => void
  onToggleSelection: (todoId: number, checked: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onChangeAdjustRequestMessage: (value: string) => void
  onChangeAdjustRequestDeadlineDate: (value: string) => void
  onOpenSelectionInEditor: () => void
  onSendAdjustRequest: () => void
}

export const TodoWorkbenchPanel = ({
  todoWorkbenchFilter,
  selectedWorkbenchTodoIds,
  workbenchTodos,
  isMonthlySchedulesPending,
  adjustRequestMessage,
  adjustRequestDeadlineDate,
  isSendPending,
  onChangeFilter,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onChangeAdjustRequestMessage,
  onChangeAdjustRequestDeadlineDate,
  onOpenSelectionInEditor,
  onSendAdjustRequest,
}: TodoWorkbenchPanelPropsInterface) => {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">TODO 워크벤치</h3>
          <Select
            value={todoWorkbenchFilter}
            onValueChange={(value) => onChangeFilter(value as TodoWorkbenchDateFilterType)}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAY">오늘</SelectItem>
              <SelectItem value="THIS_WEEK">이번 주</SelectItem>
              <SelectItem value="THIS_MONTH">이번 달</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          에이전트와 연결된 TODO를 날짜와 무관하게 선택해 조정 요청할 수 있습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {selectedWorkbenchTodoIds.length}개 선택 / 총 {workbenchTodos.length}개
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="xs" variant="outline" onClick={onSelectAll}>
              전체 선택
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={onClearSelection}>
              선택 해제
            </Button>
          </div>
        </div>

        <div className="max-h-[min(1000px,calc(100dvh-480px))] space-y-2 overflow-auto pr-1">
          {isMonthlySchedulesPending ? (
            <p className="text-xs text-muted-foreground">TODO를 불러오는 중입니다...</p>
          ) : workbenchTodos.length === 0 ? (
            <p className="text-xs text-muted-foreground">조건에 맞는 TODO가 없습니다.</p>
          ) : (
            workbenchTodos.map((todo) => {
              const checked = selectedWorkbenchTodoIds.includes(todo.id)
              return (
                <label
                  key={todo.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded border p-2',
                    checked ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggleSelection(todo.id, event.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium wrap-break-word">{todo.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {todo.occurrenceDate} {todo.startAt.slice(11, 16)}-{todo.endAt.slice(11, 16)}
                    </p>
                  </div>
                </label>
              )
            })
          )}
        </div>

        <div className="space-y-2 rounded-md border p-2">
          <p className="text-xs font-medium">조정 요청 채팅 만들기</p>
          <Textarea
            rows={2}
            value={adjustRequestMessage}
            onChange={(event) => onChangeAdjustRequestMessage(event.target.value)}
            placeholder="예: 선택한 일정이 너무 빡빡해요. 다음주 수요일까지 끝낼 수 있게 조정해주세요."
          />
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">희망 완료 기한 (선택)</p>
            <Input
              type="date"
              value={adjustRequestDeadlineDate}
              onChange={(event) => onChangeAdjustRequestDeadlineDate(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onOpenSelectionInEditor}
            disabled={selectedWorkbenchTodoIds.length === 0}
          >
            선택 항목 편집 패널로 열기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSendAdjustRequest}
            disabled={selectedWorkbenchTodoIds.length === 0 || isSendPending}
          >
            조정 요청 채팅 보내기
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
