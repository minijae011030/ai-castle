import { TodoAdjustPanel } from '@/components/agents/todo-adjust-panel'
import { TodoRegisterPanel } from '@/components/agents/todo-register-panel'
import { AgentSettingsPanel } from '@/components/agents/agent-settings-panel'
import { AgentBoundTodoPanel } from '@/components/agents/agent-bound-todo-panel'
import { AgentChatBox } from '@/components/agents/agent-chat-box'
import { AgentListPanel } from '@/components/agents/agent-list-panel'
import {
  useAgentPinnedMemoryList,
  useAgentRoleList,
  useCreateAgentRole,
  useDeleteAgentPinnedMemory,
  useUpdateAgentPinnedMemory,
  useUpdateAgentRole,
} from '@/hooks/queries/agent-query'
import {
  useSchedulesByMonth,
  useToggleRecurringScheduleDone,
  useToggleScheduleDone,
} from '@/hooks/queries/schedule-query'
import { createSchedule, deleteSchedule } from '@/services/schedule-service'
import type {
  AgentRoleDataInterface,
  TodoDraftItemInterface,
  TodoDraftPanelType,
} from '@/types/agent.type'
import type { ChatMessageInterface } from '@/types/chat.type'
import type { ScheduleCreateBodyInterface } from '@/types/schedule.type'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const emptyForm = {
  name: '',
  roleType: 'SUB' as 'MAIN' | 'SUB',
  systemPrompt: '',
  mainAgentId: null as number | null,
}
const lastChatAgentStorageKey = 'agents:last_chat_agent_id'

export const AgentListPage = () => {
  const queryClient = useQueryClient()
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [chatAgentId, setChatAgentId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const rawValue = window.localStorage.getItem(lastChatAgentStorageKey)
    if (!rawValue) return null
    const parsedValue = Number(rawValue)
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) return null
    return parsedValue
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [todoDraftItems, setTodoDraftItems] = useState<TodoDraftItemInterface[]>([])
  const [todoDraftSourceMessageId, setTodoDraftSourceMessageId] = useState<string | null>(null)
  const [todoDraftPanelType, setTodoDraftPanelType] = useState<TodoDraftPanelType>('REGISTER')
  const [isTodoRegistering, setIsTodoRegistering] = useState(false)
  const [todoDraftGroupTitle, setTodoDraftGroupTitle] = useState<string>('그룹')

  const { data: agents = [], isPending } = useAgentRoleList()
  const todayBaseDate = useMemo(() => new Date(), [])
  const currentYear = todayBaseDate.getFullYear()
  const currentMonth = todayBaseDate.getMonth() + 1
  const { data: monthlySchedules = [], isPending: isMonthlySchedulesPending } = useSchedulesByMonth(
    currentYear,
    currentMonth,
  )

  // 초기 진입 시에는 state를 effect로 세팅하지 않고, 파생값으로 "첫 에이전트 채팅"을 기본으로 보여준다.
  const effectiveChatAgentId = chatAgentId ?? agents[0]?.id ?? null
  const effectiveSelectedAgentId = selectedAgentId ?? effectiveChatAgentId

  const createMutation = useCreateAgentRole()
  const updateMutation = useUpdateAgentRole()
  const { data: pinnedMemoryItems = [], isPending: isPinnedMemoryPending } =
    useAgentPinnedMemoryList(selectedAgentId ?? 0)
  const deletePinnedMemoryMutation = useDeleteAgentPinnedMemory(selectedAgentId ?? 0)
  const updatePinnedMemoryMutation = useUpdateAgentPinnedMemory(selectedAgentId ?? 0)
  const toggleScheduleDoneMutation = useToggleScheduleDone()
  const toggleRecurringDoneMutation = useToggleRecurringScheduleDone()

  const workbenchTodos = useMemo(() => {
    if (effectiveChatAgentId === null) return []

    const toSafeDate = (value: string) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    }

    return monthlySchedules
      .filter((schedule) => {
        if (schedule.type !== 'TODO') return false
        if (schedule.agentId !== effectiveChatAgentId) return false
        const parsed = toSafeDate(schedule.startAt)
        if (!parsed) return false
        return true
      })
      .sort((a, b) => {
        const aTime = new Date(a.startAt).getTime()
        const bTime = new Date(b.startAt).getTime()
        return aTime - bTime
      })
  }, [effectiveChatAgentId, monthlySchedules])

  const recurringSchedules = useMemo(
    () => monthlySchedules.filter((schedule) => schedule.type === 'RECURRING_OCCURRENCE'),
    [monthlySchedules],
  )
  const calendarEvents = useMemo(
    () => monthlySchedules.filter((schedule) => schedule.type === 'CALENDAR_EVENT'),
    [monthlySchedules],
  )
  const boundTodos = useMemo(
    () =>
      monthlySchedules
        .filter((schedule) => schedule.type === 'TODO')
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [monthlySchedules],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (chatAgentId === null) {
      window.localStorage.removeItem(lastChatAgentStorageKey)
      return
    }
    window.localStorage.setItem(lastChatAgentStorageKey, String(chatAgentId))
  }, [chatAgentId])

  useEffect(() => {
    if (chatAgentId === null) return
    if (agents.length === 0) return
    const exists = agents.some((agent) => agent.id === chatAgentId)
    if (!exists) {
      setChatAgentId(agents[0]?.id ?? null)
    }
  }, [agents, chatAgentId])

  const buildEmptyDraftItem = (): TodoDraftItemInterface => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const baseDate = `${yyyy}-${mm}-${dd}`
    return {
      draftId: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sourceScheduleId: null,
      selected: true,
      title: '',
      description: '',
      estimateMinutes: 30,
      priority: 'MEDIUM',
      status: 'TODO',
      scheduledDate: baseDate,
      startAt: `${baseDate}T20:00:00`,
      endAt: `${baseDate}T20:30:00`,
    }
  }

  const findSourceScheduleIdForAdjustedDraft = (draft: {
    title: string
    scheduledDate: string
    startAt: string
    endAt: string
  }): number | null => {
    const normalizedTitle = draft.title.trim()
    if (!normalizedTitle) return null

    const strictMatched = workbenchTodos.filter(
      (todo) =>
        todo.title.trim() === normalizedTitle &&
        todo.occurrenceDate === draft.scheduledDate &&
        todo.startAt === draft.startAt &&
        todo.endAt === draft.endAt,
    )
    if (strictMatched.length === 1) return strictMatched[0]?.id ?? null

    // 시간이 조금 변형된 응답도 잡기 위해 title+date 기준으로 한 번 더 시도
    const looseMatched = workbenchTodos.filter(
      (todo) =>
        todo.title.trim() === normalizedTitle && todo.occurrenceDate === draft.scheduledDate,
    )
    if (looseMatched.length === 1) return looseMatched[0]?.id ?? null

    return null
  }

  const openTodoDraftPanel = (message: ChatMessageInterface) => {
    const sourceItems = message.todo ?? []
    if (sourceItems.length === 0) return
    const panelType: TodoDraftPanelType =
      message.mode === 'TODO_NEGOTIATION' ? 'ADJUST' : 'REGISTER'
    setTodoDraftSourceMessageId(message.id)
    setTodoDraftPanelType(panelType)
    setTodoDraftGroupTitle(message.groupTitle ?? '그룹')
    setTodoDraftItems(
      sourceItems.map((item, index) => ({
        draftId: `${message.id}-${index}`,
        sourceScheduleId:
          item.sourceScheduleId ??
          (panelType === 'ADJUST'
            ? findSourceScheduleIdForAdjustedDraft({
                title: item.title,
                scheduledDate: item.scheduledDate,
                startAt: item.startAt,
                endAt: item.endAt,
              })
            : null),
        selected: true,
        title: item.title,
        description: item.description ?? '',
        estimateMinutes: item.estimateMinutes ?? null,
        priority: item.priority,
        status: item.status,
        scheduledDate: item.scheduledDate,
        startAt: item.startAt,
        endAt: item.endAt,
      })),
    )
  }

  const updateTodoDraftItem = (
    draftId: string,
    updater: (previous: TodoDraftItemInterface) => TodoDraftItemInterface,
  ) => {
    setTodoDraftItems((previous) =>
      previous.map((item) => (item.draftId === draftId ? updater(item) : item)),
    )
  }

  const registerTodoDraftItems = async () => {
    if (effectiveChatAgentId === null || isTodoRegistering) return
    const selectedItems = todoDraftItems.filter((item) => item.selected)
    if (selectedItems.length === 0) {
      toast.error('등록할 투두를 선택하세요.')
      return
    }

    const validItems = selectedItems.filter((item) => {
      return (
        item.title.trim() && item.scheduledDate.trim() && item.startAt.trim() && item.endAt.trim()
      )
    })
    if (validItems.length === 0) {
      toast.error('선택한 투두의 제목/날짜/시간을 확인하세요.')
      return
    }

    setIsTodoRegistering(true)
    try {
      // REGISTER는 새 그룹 생성, ADJUST는 원본 그룹 유지가 기본이다.
      const nextGroupId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const normalizedGroupTitle = todoDraftGroupTitle.trim() || '그룹'

      const requestItems = validItems.map((item) => {
        const resolvedSourceScheduleId =
          item.sourceScheduleId ??
          (todoDraftPanelType === 'ADJUST'
            ? findSourceScheduleIdForAdjustedDraft({
                title: item.title,
                scheduledDate: item.scheduledDate,
                startAt: item.startAt,
                endAt: item.endAt,
              })
            : null)
        const sourceSchedule =
          todoDraftPanelType === 'ADJUST' && resolvedSourceScheduleId
            ? (monthlySchedules.find(
                (schedule) => schedule.type === 'TODO' && schedule.id === resolvedSourceScheduleId,
              ) ?? null)
            : null

        return {
          draftId: item.draftId,
          sourceScheduleId: resolvedSourceScheduleId,
          body: {
            type: 'TODO' as const,
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            occurrenceDate: item.scheduledDate,
            startAt: item.startAt,
            endAt: item.endAt,
            agentId: effectiveChatAgentId,
            groupId:
              todoDraftPanelType === 'ADJUST'
                ? (sourceSchedule?.groupId ?? nextGroupId ?? undefined)
                : (nextGroupId ?? undefined),
            groupTitle:
              todoDraftPanelType === 'ADJUST'
                ? (sourceSchedule?.groupTitle ?? normalizedGroupTitle)
                : normalizedGroupTitle,
          },
        }
      })

      const createTargets = requestItems

      // 동시 요청을 줄여 DB 경합/부분 실패를 방지한다. (데이터 일관성 우선)
      const createResults: PromiseSettledResult<unknown>[] = []
      for (const item of createTargets) {
        const result = await Promise.resolve()
          .then(() => createSchedule(item.body as ScheduleCreateBodyInterface))
          .then(
            (value) => ({ status: 'fulfilled', value }) as const,
            (reason) => ({ status: 'rejected', reason }) as const,
          )
        createResults.push(result)
      }
      const successIndexes = createResults
        .map((result, index) => (result.status === 'fulfilled' ? index : -1))
        .filter((index) => index >= 0)
      const successCount = successIndexes.length
      const failCount = createResults.length - successCount

      const sourceIdsUsedForDelete = new Set<number>()
      let removedOriginalCount = 0
      // 삭제(치환)는 조정(ADJUST) 모드에서만 수행한다. (REGISTER에서는 원본을 건드리지 않음)
      if (todoDraftPanelType === 'ADJUST' && successIndexes.length > 0) {
        const sourceIdsToDelete = successIndexes
          .map((index) => createTargets[index]?.sourceScheduleId)
          .filter((id): id is number => typeof id === 'number' && id > 0)

        if (sourceIdsToDelete.length > 0) {
          sourceIdsToDelete.forEach((id) => sourceIdsUsedForDelete.add(id))
          const deleteResults = await Promise.allSettled(
            sourceIdsToDelete.map((id) => deleteSchedule(id)),
          )
          removedOriginalCount = deleteResults.filter(
            (result) => result.status === 'fulfilled',
          ).length
        }
      }

      if (successCount > 0 || removedOriginalCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ['schedule'] })
      }

      if (failCount === 0) {
        if (removedOriginalCount > 0) {
          toast.success(
            `${successCount}개의 조정 TODO를 등록하고 기존 TODO ${removedOriginalCount}개를 삭제했습니다.`,
          )
        } else {
          toast.success(
            todoDraftPanelType === 'ADJUST'
              ? `${successCount}개의 조정 TODO를 등록했습니다.`
              : `${successCount}개의 투두를 캘린더에 등록했습니다.`,
          )
        }
        setTodoDraftItems((previous) => previous.filter((item) => !item.selected))
      } else if (successCount > 0) {
        toast.error(`${successCount}개 성공, ${failCount}개 실패했습니다.`)
      } else {
        toast.error('투두 등록에 실패했습니다.')
      }
    } finally {
      setIsTodoRegistering(false)
    }
  }

  // 새 에이전트 추가 버튼 클릭 핸들러
  const handleChangeNew = () => {
    setIsSettingsOpen(true)
    setSelectedAgentId(null)
    setForm(emptyForm)
    setChatAgentId(null)
  }

  // 에이전트 저장 버튼 클릭 핸들러
  const handleSubmit = async () => {
    const name = form.name.trim()
    const systemPrompt = form.systemPrompt.trim()
    if (!name || !systemPrompt) return
    if (form.roleType === 'SUB' && !form.mainAgentId) {
      toast.error('서브 에이전트는 메인 에이전트를 선택해야 합니다.')
      return
    }

    if (selectedAgentId === null) {
      await createMutation.mutateAsync({
        name,
        roleType: form.roleType,
        systemPrompt: systemPrompt,
        mainAgentId: form.roleType === 'SUB' ? form.mainAgentId : null,
      })
      setForm(emptyForm)
    } else {
      await updateMutation.mutateAsync({
        id: selectedAgentId,
        body: {
          systemPrompt: systemPrompt,
          mainAgentId: form.roleType === 'SUB' ? form.mainAgentId : null,
        },
      })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  // 에이전트 설정 버튼 클릭 핸들러
  const handleSelectAgentForSettings = (agent: AgentRoleDataInterface) => {
    setIsSettingsOpen(true)
    setChatAgentId(null)
    setSelectedAgentId(agent.id)
    setForm({
      name: agent.name,
      roleType: agent.roleType,
      systemPrompt: agent.systemPrompt,
      mainAgentId: agent.mainAgentId,
    })
  }

  // 채팅 창 열기 버튼 클릭 핸들러
  const handleOpenChat = (agent: AgentRoleDataInterface) => {
    setIsSettingsOpen(false)
    setChatAgentId(agent.id)
    setSelectedAgentId(agent.id)
    setForm({
      name: agent.name,
      roleType: agent.roleType,
      systemPrompt: agent.systemPrompt,
      mainAgentId: agent.mainAgentId,
    })
  }

  const handleSaveEditedMemory = (memoryId: number, content: string, onSuccess: () => void) => {
    const trimmedContent = content.trim()
    if (!trimmedContent) return
    updatePinnedMemoryMutation.mutate(
      {
        memory_id: memoryId,
        body: { content: trimmedContent },
      },
      {
        onSuccess: () => {
          onSuccess()
        },
      },
    )
  }

  const handleDeleteMemory = (memoryId: number) => {
    deletePinnedMemoryMutation.mutate({ memory_id: memoryId })
  }

  const handleOpenChatSettings = () => {
    const targetAgent = agents.find((agent) => agent.id === effectiveChatAgentId) ?? null
    if (targetAgent) {
      handleSelectAgentForSettings(targetAgent)
    } else {
      setIsSettingsOpen(true)
    }
  }

  const handleCloseTodoDraftPanel = () => {
    setTodoDraftItems([])
    setTodoDraftSourceMessageId(null)
    setTodoDraftPanelType('REGISTER')
    setTodoDraftGroupTitle('그룹')
  }

  const handleRemoveTodoDraftItem = (draftId: string) => {
    setTodoDraftItems((previous) => previous.filter((draftItem) => draftItem.draftId !== draftId))
  }

  const handleAddTodoDraftItem = () => {
    setTodoDraftItems((previous) => [...previous, buildEmptyDraftItem()])
  }

  return (
    <div className="flex h-full gap-4">
      <AgentListPanel
        isPending={isPending}
        agents={agents}
        effectiveSelectedAgentId={effectiveSelectedAgentId}
        onCreateNew={handleChangeNew}
        onOpenChat={handleOpenChat}
      />

      <div className="flex min-w-0 flex-1">
        {isSettingsOpen || effectiveChatAgentId === null ? (
          <AgentSettingsPanel
            key={`agent-settings-${selectedAgentId ?? 'new'}`}
            selectedAgentId={selectedAgentId}
            form={form}
            agents={agents}
            isSubmitting={isSubmitting}
            isPinnedMemoryPending={isPinnedMemoryPending}
            pinnedMemoryItems={pinnedMemoryItems}
            isDeletePinnedMemoryPending={deletePinnedMemoryMutation.isPending}
            isUpdatePinnedMemoryPending={updatePinnedMemoryMutation.isPending}
            onChangeForm={setForm}
            onSubmit={handleSubmit}
            onSaveEditedMemory={handleSaveEditedMemory}
            onDeleteMemory={handleDeleteMemory}
          />
        ) : (
          <div className="flex w-full gap-4">
            <AgentChatBox
              agentId={effectiveChatAgentId}
              chatAgentName={agents.find((agent) => agent.id === effectiveChatAgentId)?.name}
              onOpenSettings={handleOpenChatSettings}
              onOpenTodoDraftPanel={openTodoDraftPanel}
            />

            <div className="w-md shrink-0 space-y-3">
              <AgentBoundTodoPanel
                fixedSchedules={recurringSchedules}
                calendarEvents={calendarEvents}
                boundTodos={boundTodos}
                isPending={isMonthlySchedulesPending}
                onToggleDone={(schedule) => {
                  const isRecurring =
                    schedule.type === 'RECURRING_OCCURRENCE' &&
                    schedule.recurringTemplateId !== null
                  if (isRecurring && schedule.recurringTemplateId) {
                    toggleRecurringDoneMutation.mutate({
                      templateId: schedule.recurringTemplateId,
                      date: schedule.occurrenceDate,
                    })
                    return
                  }
                  toggleScheduleDoneMutation.mutate({ id: schedule.id })
                }}
              />
              {todoDraftItems.length > 0 ? (
                todoDraftPanelType === 'ADJUST' ? (
                  <TodoAdjustPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    groupTitle={todoDraftGroupTitle}
                    isTodoRegistering={isTodoRegistering}
                    onClose={handleCloseTodoDraftPanel}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={handleRemoveTodoDraftItem}
                    onAddDraftItem={handleAddTodoDraftItem}
                    onApplyAdjustments={registerTodoDraftItems}
                    onChangeGroupTitle={setTodoDraftGroupTitle}
                  />
                ) : (
                  <TodoRegisterPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    groupTitle={todoDraftGroupTitle}
                    isTodoRegistering={isTodoRegistering}
                    onClose={handleCloseTodoDraftPanel}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={handleRemoveTodoDraftItem}
                    onAddDraftItem={handleAddTodoDraftItem}
                    onRegister={registerTodoDraftItems}
                    onChangeGroupTitle={setTodoDraftGroupTitle}
                  />
                )
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
