import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import type { AgentPinnedMemoryInterface } from '@/types/agent-memory.type'
import { useState } from 'react'

interface AgentSettingsFormInterface {
  name: string
  roleType: 'MAIN' | 'SUB'
  systemPrompt: string
  mainAgentId: number | null
}

interface AgentSettingsPanelPropsInterface {
  selectedAgentId: number | null
  form: AgentSettingsFormInterface
  agents: AgentRoleDataInterface[]
  isSubmitting: boolean
  isPinnedMemoryPending: boolean
  pinnedMemoryItems: AgentPinnedMemoryInterface[]
  isDeletePinnedMemoryPending: boolean
  isUpdatePinnedMemoryPending: boolean
  onChangeForm: (
    updater: (previous: AgentSettingsFormInterface) => AgentSettingsFormInterface,
  ) => void
  onSubmit: () => void
  onSaveEditedMemory: (memoryId: number, content: string, onSuccess: () => void) => void
  onDeleteMemory: (memoryId: number) => void
}

export const AgentSettingsPanel = ({
  selectedAgentId,
  form,
  agents,
  isSubmitting,
  isPinnedMemoryPending,
  pinnedMemoryItems,
  isDeletePinnedMemoryPending,
  isUpdatePinnedMemoryPending,
  onChangeForm,
  onSubmit,
  onSaveEditedMemory,
  onDeleteMemory,
}: AgentSettingsPanelPropsInterface) => {
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null)
  const [editingMemoryContent, setEditingMemoryContent] = useState('')

  const handleStartEditMemory = (memoryId: number, content: string) => {
    setEditingMemoryId(memoryId)
    setEditingMemoryContent(content)
  }

  const handleCancelEditMemory = () => {
    setEditingMemoryId(null)
    setEditingMemoryContent('')
  }

  const handleSaveEditedMemory = (memoryId: number) => {
    onSaveEditedMemory(memoryId, editingMemoryContent, () => {
      setEditingMemoryId(null)
      setEditingMemoryContent('')
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <h2 className="text-sm font-semibold">
          {selectedAgentId === null ? '새 에이전트 추가' : '에이전트 설정'}
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="agent-name">에이전트 이름</Label>
          <Input
            id="agent-name"
            value={form.name}
            onChange={(event) =>
              onChangeForm((previous) => ({ ...previous, name: event.target.value }))
            }
            placeholder="예: 코테 과외쌤"
            disabled={selectedAgentId !== null}
          />
        </div>
        <div className="grid gap-2">
          <Label>에이전트 타입</Label>
          <div className="flex gap-2 text-xs">
            <Button
              type="button"
              size="xs"
              variant={form.roleType === 'MAIN' ? 'default' : 'outline'}
              onClick={() => onChangeForm((previous) => ({ ...previous, roleType: 'MAIN' }))}
              disabled={selectedAgentId !== null}
            >
              메인 에이전트
            </Button>
            <Button
              type="button"
              size="xs"
              variant={form.roleType === 'SUB' ? 'default' : 'outline'}
              onClick={() => onChangeForm((previous) => ({ ...previous, roleType: 'SUB' }))}
              disabled={selectedAgentId !== null}
            >
              서브 에이전트
            </Button>
          </div>
        </div>
        {form.roleType === 'SUB' && (
          <div className="grid gap-2">
            <Label>연결할 메인 에이전트</Label>
            <Select
              value={form.mainAgentId ? String(form.mainAgentId) : '__none__'}
              onValueChange={(value) =>
                onChangeForm((previous) => ({
                  ...previous,
                  mainAgentId: value === '__none__' ? null : Number(value),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="메인 에이전트를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">선택 안함</SelectItem>
                {agents
                  .filter((agent) => agent.roleType === 'MAIN')
                  .map((mainAgent) => (
                    <SelectItem key={mainAgent.id} value={String(mainAgent.id)}>
                      {mainAgent.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="agent-system-prompt">시스템 프롬프트</Label>
          <Textarea
            id="agent-system-prompt"
            value={form.systemPrompt}
            onChange={(event) =>
              onChangeForm((previous) => ({ ...previous, systemPrompt: event.target.value }))
            }
            placeholder="이 에이전트가 어떤 역할/말투/전략으로 답할지 작성해 주세요."
            rows={10}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {selectedAgentId === null ? '에이전트 생성' : '프롬프트 저장'}
          </Button>
        </div>
        {selectedAgentId !== null && (
          <div className="grid gap-2">
            <Label>저장된 메모리</Label>
            <div className="flex max-h-[600px] flex-col gap-2 overflow-auto">
              {isPinnedMemoryPending ? (
                <p className="text-xs text-muted-foreground">메모리를 불러오는 중입니다...</p>
              ) : pinnedMemoryItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">저장된 메모리가 없습니다.</p>
              ) : (
                pinnedMemoryItems.map((memory) => (
                  <div
                    key={memory.id}
                    className="flex items-start justify-between gap-3 rounded border bg-card p-5"
                  >
                    {editingMemoryId === memory.id ? (
                      <div className="flex w-full flex-col gap-2">
                        <Textarea
                          value={editingMemoryContent}
                          onChange={(event) => setEditingMemoryContent(event.target.value)}
                          rows={4}
                          placeholder="메모리 내용을 수정하세요."
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={handleCancelEditMemory}
                            disabled={isUpdatePinnedMemoryPending}
                          >
                            취소
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => handleSaveEditedMemory(memory.id)}
                            disabled={isUpdatePinnedMemoryPending}
                          >
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <MarkdownMessage content={memory.content} className="text-xs" />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => handleStartEditMemory(memory.id, memory.content)}
                            disabled={isDeletePinnedMemoryPending || isUpdatePinnedMemoryPending}
                          >
                            수정
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => onDeleteMemory(memory.id)}
                            disabled={isDeletePinnedMemoryPending || isUpdatePinnedMemoryPending}
                          >
                            삭제
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
