import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface TodoDraftItemInterface {
  draftId: string
  sourceScheduleId: number | null
  selected: boolean
  title: string
  description: string
  estimateMinutes: number | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'TODO' | 'DONE'
  scheduledDate: string
  startAt: string
  endAt: string
}

interface TodoRegisterPanelPropsInterface {
  sourceMessageId: string | null
  draftItems: TodoDraftItemInterface[]
  isTodoRegistering: boolean
  onClose: () => void
  onUpdateDraftItem: (
    draftId: string,
    updater: (previous: TodoDraftItemInterface) => TodoDraftItemInterface,
  ) => void
  onRemoveDraftItem: (draftId: string) => void
  onAddDraftItem: () => void
  onRegister: () => void
}

export const TodoRegisterPanel = ({
  sourceMessageId,
  draftItems,
  isTodoRegistering,
  onClose,
  onUpdateDraftItem,
  onRemoveDraftItem,
  onAddDraftItem,
  onRegister,
}: TodoRegisterPanelPropsInterface) => {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">투두 등록 패널</h3>
          <Button type="button" size="xs" variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          메시지 #{sourceMessageId}에서 가져온 투두입니다. 수정/부분 삭제 후 등록하세요.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="max-h-[min(1000px,calc(100dvh-270px))] space-y-2 overflow-auto pr-1">
          {draftItems.map((item) => (
            <div key={item.draftId} className="space-y-2 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) => {
                      onUpdateDraftItem(item.draftId, (previous) => ({
                        ...previous,
                        selected: event.target.checked,
                      }))
                    }}
                  />
                  등록 대상
                </label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onRemoveDraftItem(item.draftId)}
                >
                  삭제
                </Button>
              </div>

              <Input
                value={item.title}
                onChange={(event) =>
                  onUpdateDraftItem(item.draftId, (previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
                placeholder="제목"
              />
              <Textarea
                rows={2}
                value={item.description}
                onChange={(event) =>
                  onUpdateDraftItem(item.draftId, (previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="설명"
              />
              <div className="grid grid-cols-1 gap-2">
                <Input
                  type="date"
                  value={item.scheduledDate}
                  onChange={(event) =>
                    onUpdateDraftItem(item.draftId, (previous) => {
                      const nextDate = event.target.value
                      const nextStartTime = previous.startAt.slice(11, 19) || '20:00:00'
                      const nextEndTime = previous.endAt.slice(11, 19) || '21:00:00'
                      return {
                        ...previous,
                        scheduledDate: nextDate,
                        startAt: `${nextDate}T${nextStartTime}`,
                        endAt: `${nextDate}T${nextEndTime}`,
                      }
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={item.startAt.slice(11, 16)}
                  onChange={(event) =>
                    onUpdateDraftItem(item.draftId, (previous) => ({
                      ...previous,
                      startAt: `${previous.scheduledDate}T${event.target.value}:00`,
                    }))
                  }
                />
                <Input
                  type="time"
                  value={item.endAt.slice(11, 16)}
                  onChange={(event) =>
                    onUpdateDraftItem(item.draftId, (previous) => ({
                      ...previous,
                      endAt: `${previous.scheduledDate}T${event.target.value}:00`,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" size="xs" variant="outline" onClick={onAddDraftItem}>
            + 항목 추가
          </Button>
          <Button type="button" size="sm" onClick={onRegister} disabled={isTodoRegistering}>
            선택 항목 캘린더 등록
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
