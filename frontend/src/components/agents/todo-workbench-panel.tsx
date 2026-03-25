import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import { useMemo, useState } from 'react'

type TodoWorkbenchDateFilterType = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'GROUP'

export interface TodoGroupInterface {
  groupKey: string
  groupId: string | null
  groupTitle: string | null
  todos: ScheduleOccurrenceInterface[]
}

interface TodoWorkbenchPanelPropsInterface {
  todoWorkbenchFilter: TodoWorkbenchDateFilterType
  selectedWorkbenchTodoIds: number[]
  todoGroups: TodoGroupInterface[]
  isMonthlySchedulesPending: boolean
  adjustRequestMessage: string
  adjustRequestDeadlineDate: string
  isSendPending: boolean
  onChangeFilter: (filter: TodoWorkbenchDateFilterType) => void
  onChangeSelectedTodoIds: (nextTodoIds: number[]) => void
  onChangeAdjustRequestMessage: (value: string) => void
  onChangeAdjustRequestDeadlineDate: (value: string) => void
  onOpenSelectionInEditor: () => void
  onSendAdjustRequest: () => void
}

export const TodoWorkbenchPanel = ({
  todoWorkbenchFilter,
  selectedWorkbenchTodoIds,
  todoGroups,
  isMonthlySchedulesPending,
  adjustRequestMessage,
  adjustRequestDeadlineDate,
  isSendPending,
  onChangeFilter,
  onChangeSelectedTodoIds,
  onChangeAdjustRequestMessage,
  onChangeAdjustRequestDeadlineDate,
  onOpenSelectionInEditor,
  onSendAdjustRequest,
}: TodoWorkbenchPanelPropsInterface) => {
  const [isOpen, setIsOpen] = useState(true)
  const [groupFilterKey, setGroupFilterKey] = useState<string>('')

  const groupOptions = useMemo(() => {
    const options = todoGroups.map((group) => ({
      value: group.groupKey,
      label: group.groupTitle === null ? '미지정' : group.groupTitle,
    }))
    // 중복 groupKey 방지 (원천은 unique여야 하지만 안전장치)
    const unique = new Map<string, { value: string; label: string }>()
    for (const opt of options) unique.set(opt.value, opt)
    return Array.from(unique.values())
  }, [todoGroups])

  const handleGroupFilterChange = (value: string) => {
    setGroupFilterKey(value)
    // 그룹을 바꾸면 선택 상태를 초기화한다. (그룹 내에서 1개씩 선택 가능하게)
    onChangeSelectedTodoIds([])
  }

  const handleTodoWorkbenchFilterChange = (value: string) => {
    const next = value as TodoWorkbenchDateFilterType
    // 필터가 바뀌면 그룹 선택/선택 상태를 항상 초기화한다. (effect로 동기화하지 않음)
    if (next !== 'GROUP') {
      setGroupFilterKey('')
      onChangeSelectedTodoIds([])
    } else {
      setGroupFilterKey('')
      onChangeSelectedTodoIds([])
    }
    onChangeFilter(next)
  }

  const visibleGroups = useMemo(() => {
    if (todoWorkbenchFilter !== 'GROUP') return todoGroups
    if (!groupFilterKey) return []
    return todoGroups.filter((group) => group.groupKey === groupFilterKey)
  }, [groupFilterKey, todoGroups, todoWorkbenchFilter])

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">TODO 워크벤치</h3>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setIsOpen((previous) => !previous)}
            >
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isOpen ? '접기' : '열기'}
            </Button>
          </div>
          {isOpen ? (
            <div className="flex flex-col items-end gap-2">
              <Select value={todoWorkbenchFilter} onValueChange={handleTodoWorkbenchFilterChange}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue placeholder="기간" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAY">오늘</SelectItem>
                  <SelectItem value="THIS_WEEK">이번 주</SelectItem>
                  <SelectItem value="THIS_MONTH">이번 달</SelectItem>
                  <SelectItem value="GROUP">그룹별</SelectItem>
                </SelectContent>
              </Select>

              {todoWorkbenchFilter === 'GROUP' ? (
                <Select value={groupFilterKey} onValueChange={handleGroupFilterChange}>
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue placeholder="그룹 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          에이전트와 연결된 TODO를 날짜와 무관하게 선택해 조정 요청할 수 있습니다.
        </p>
      </CardHeader>
      {isOpen ? (
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{selectedWorkbenchTodoIds.length}개 선택</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  const allVisibleIds = visibleGroups.flatMap((g) => g.todos.map((t) => t.id))
                  onChangeSelectedTodoIds(allVisibleIds)
                }}
              >
                전체 선택
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onChangeSelectedTodoIds([])}
              >
                선택 해제
              </Button>
            </div>
          </div>

          <div className="max-h-[min(1000px,calc(100dvh-480px))] space-y-2 overflow-auto pr-1">
            {isMonthlySchedulesPending ? (
              <p className="text-xs text-muted-foreground">TODO를 불러오는 중입니다...</p>
            ) : visibleGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {todoWorkbenchFilter === 'GROUP'
                  ? '그룹을 선택하세요.'
                  : '조건에 맞는 TODO가 없습니다.'}
              </p>
            ) : (
              visibleGroups.map((group) => (
                <div key={group.groupKey} className="space-y-1 rounded-md border p-2">
                  {(() => {
                    const todoIds = group.todos.map((t) => t.id)
                    const selectedCount = todoIds.filter((id) =>
                      selectedWorkbenchTodoIds.includes(id),
                    ).length
                    const isAllSelected = selectedCount > 0 && selectedCount === todoIds.length
                    const isAnySelected = selectedCount > 0
                    return (
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={(event) => {
                              const checked = event.target.checked
                              const next = new Set(selectedWorkbenchTodoIds)
                              if (checked) {
                                todoIds.forEach((id) => next.add(id))
                              } else {
                                todoIds.forEach((id) => next.delete(id))
                              }
                              onChangeSelectedTodoIds(Array.from(next))
                            }}
                            className="mt-0.5"
                          />
                          <span className="text-xs font-semibold">
                            그룹 {group.groupTitle ?? '미지정'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {isAnySelected
                              ? `${selectedCount}/${todoIds.length}개`
                              : `${todoIds.length}개`}
                          </span>
                        </label>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            const next = new Set(selectedWorkbenchTodoIds)
                            todoIds.forEach((id) => next.delete(id))
                            onChangeSelectedTodoIds(Array.from(next))
                          }}
                          disabled={!isAnySelected}
                        >
                          그룹 해제
                        </Button>
                      </div>
                    )
                  })()}
                  <div className="space-y-1">
                    {group.todos.map((todo) => (
                      <div key={todo.id} className="rounded border border-dashed bg-background p-2">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedWorkbenchTodoIds.includes(todo.id)}
                            onChange={(event) => {
                              const checked = event.target.checked
                              const next = new Set(selectedWorkbenchTodoIds)
                              if (checked) next.add(todo.id)
                              else next.delete(todo.id)
                              onChangeSelectedTodoIds(Array.from(next))
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium wrap-break-word">{todo.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {todo.occurrenceDate} {todo.startAt.slice(11, 16)}-
                              {todo.endAt.slice(11, 16)}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))
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
      ) : null}
    </Card>
  )
}
