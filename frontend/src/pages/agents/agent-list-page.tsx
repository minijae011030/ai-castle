import { TodoAdjustPanel } from '@/components/agents/todo-adjust-panel'
import { TodoRegisterPanel } from '@/components/agents/todo-register-panel'
import { AgentSettingsPanel } from '@/components/agents/agent-settings-panel'
import { TodoWorkbenchPanel } from '@/components/agents/todo-workbench-panel'
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
import { useSchedulesByMonth } from '@/hooks/queries/schedule-query'
import { createSchedule, deleteSchedule } from '@/services/schedule-service'
import type {
  AgentRoleDataInterface,
  TodoDraftItemInterface,
  TodoDraftPanelType,
  TodoWorkbenchDateFilterType,
} from '@/types/agent.type'
import type { ChatMessageInterface, NegotiationTodoRequestItemInterface } from '@/types/chat.type'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import type { ScheduleCreateBodyInterface } from '@/types/schedule.type'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const emptyForm = {
  name: '',
  roleType: 'SUB' as 'MAIN' | 'SUB',
  systemPrompt: '',
  mainAgentId: null as number | null,
}

export const AgentListPage = () => {
  const queryClient = useQueryClient()
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [chatAgentId, setChatAgentId] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [todoDraftItems, setTodoDraftItems] = useState<TodoDraftItemInterface[]>([])
  const [todoDraftSourceMessageId, setTodoDraftSourceMessageId] = useState<string | null>(null)
  const [todoDraftPanelType, setTodoDraftPanelType] = useState<TodoDraftPanelType>('REGISTER')
  const [isTodoRegistering, setIsTodoRegistering] = useState(false)
  const [negotiationSourceTodoIdsByMessageId, setNegotiationSourceTodoIdsByMessageId] = useState<
    Record<string, number[]>
  >({})
  const [todoWorkbenchFilter, setTodoWorkbenchFilter] =
    useState<TodoWorkbenchDateFilterType>('THIS_WEEK')
  const [selectedWorkbenchTodoIds, setSelectedWorkbenchTodoIds] = useState<number[]>([])
  const [adjustRequestMessage, setAdjustRequestMessage] =
    useState('선택한 일정이 빡빡해서 조정이 필요해요.')
  const [adjustRequestDeadlineDate, setAdjustRequestDeadlineDate] = useState('')
  const negotiationSenderRef = useRef<
    | ((payload: {
        content: string
        negotiationTodos: NegotiationTodoRequestItemInterface[]
        preferredDeadlineDate?: string
      }) => boolean)
    | null
  >(null)
  const [isChatSendPending, setIsChatSendPending] = useState(false)

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

  const workbenchTodos = useMemo(() => {
    if (effectiveChatAgentId === null) return []

    const dayStart = new Date(todayBaseDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(todayBaseDate)
    dayEnd.setHours(23, 59, 59, 999)

    const weekStart = new Date(dayStart)
    const day = weekStart.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    weekStart.setDate(weekStart.getDate() - diffToMonday)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const toSafeDate = (value: string) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const isInRange = (targetDate: Date) => {
      if (todoWorkbenchFilter === 'TODAY') {
        return targetDate >= dayStart && targetDate <= dayEnd
      }
      if (todoWorkbenchFilter === 'THIS_WEEK') {
        return targetDate >= weekStart && targetDate <= weekEnd
      }
      return true
    }

    return monthlySchedules
      .filter((schedule) => {
        if (schedule.type !== 'TODO') return false
        if (schedule.agentId !== effectiveChatAgentId) return false
        const parsed = toSafeDate(schedule.startAt)
        if (!parsed) return false
        return isInRange(parsed)
      })
      .sort((a, b) => {
        const aTime = new Date(a.startAt).getTime()
        const bTime = new Date(b.startAt).getTime()
        return aTime - bTime
      })
  }, [effectiveChatAgentId, monthlySchedules, todayBaseDate, todoWorkbenchFilter])

  useEffect(() => {
    setSelectedWorkbenchTodoIds((previous) => {
      const next = previous.filter((todoId) => workbenchTodos.some((todo) => todo.id === todoId))
      if (
        next.length === previous.length &&
        next.every((todoId, index) => todoId === previous[index])
      ) {
        return previous
      }
      return next
    })
  }, [workbenchTodos])

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

  const openTodoDraftPanel = (message: ChatMessageInterface) => {
    const sourceItems = message.todo ?? []
    if (sourceItems.length === 0) return
    const sourceIdsForReplace = negotiationSourceTodoIdsByMessageId[message.id] ?? []
    const panelType: TodoDraftPanelType =
      message.mode === 'TODO_NEGOTIATION' ? 'ADJUST' : 'REGISTER'
    setTodoDraftSourceMessageId(message.id)
    setTodoDraftPanelType(panelType)
    setTodoDraftItems(
      sourceItems.map((item, index) => ({
        draftId: `${message.id}-${index}`,
        sourceScheduleId:
          item.sourceScheduleId ??
          (panelType === 'ADJUST' ? (sourceIdsForReplace[index] ?? null) : null),
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

  const convertScheduleToDraftItem = (
    schedule: ScheduleOccurrenceInterface,
  ): TodoDraftItemInterface => {
    const occurrenceDate = schedule.occurrenceDate
    const fallbackStartAt = `${occurrenceDate}T20:00:00`
    const fallbackEndAt = `${occurrenceDate}T20:30:00`
    return {
      draftId: `workbench-${schedule.id}`,
      sourceScheduleId: schedule.id,
      selected: true,
      title: schedule.title,
      description: schedule.description ?? '',
      estimateMinutes: null,
      priority: 'MEDIUM',
      status: schedule.done ? 'DONE' : 'TODO',
      scheduledDate: occurrenceDate,
      startAt: schedule.startAt || fallbackStartAt,
      endAt: schedule.endAt || fallbackEndAt,
    }
  }

  const handleToggleWorkbenchTodoSelection = (todoId: number, checked: boolean) => {
    setSelectedWorkbenchTodoIds((previous) => {
      if (checked) {
        if (previous.includes(todoId)) return previous
        return [...previous, todoId]
      }
      return previous.filter((id) => id !== todoId)
    })
  }

  const handleSelectAllWorkbenchTodos = () => {
    setSelectedWorkbenchTodoIds(workbenchTodos.map((todo) => todo.id))
  }

  const handleClearWorkbenchSelection = () => {
    setSelectedWorkbenchTodoIds([])
  }

  const handleOpenWorkbenchSelectionInEditor = () => {
    const selectedTodos = workbenchTodos.filter((todo) =>
      selectedWorkbenchTodoIds.includes(todo.id),
    )
    if (selectedTodos.length === 0) {
      toast.error('워크벤치에서 TODO를 먼저 선택하세요.')
      return
    }
    setTodoDraftSourceMessageId('workbench')
    setTodoDraftPanelType('ADJUST')
    setTodoDraftItems(selectedTodos.map(convertScheduleToDraftItem))
  }

  const handleRequestTodoNegotiation = () => {
    if (selectedWorkbenchTodoIds.length === 0) {
      toast.error('조정할 TODO를 먼저 선택하세요.')
      return
    }
    if (effectiveChatAgentId === null || isChatSendPending) {
      return
    }

    const selectedTodos = workbenchTodos.filter((todo) =>
      selectedWorkbenchTodoIds.includes(todo.id),
    )
    if (selectedTodos.length === 0) {
      toast.error('선택된 TODO를 찾지 못했습니다. 다시 선택해주세요.')
      return
    }

    const trimmedRequestMessage = adjustRequestMessage.trim()
    if (!trimmedRequestMessage) {
      toast.error('조정 요청 문구를 입력해주세요.')
      return
    }

    const negotiationTodos: NegotiationTodoRequestItemInterface[] = selectedTodos.map((todo) => ({
      scheduleId: todo.id,
      title: todo.title,
      occurrenceDate: todo.occurrenceDate,
      startAt: todo.startAt,
      endAt: todo.endAt,
    }))

    const requestContent = trimmedRequestMessage

    const sendNegotiation = negotiationSenderRef.current
    if (!sendNegotiation) return

    const didSend = sendNegotiation({
      content: requestContent,
      negotiationTodos,
      preferredDeadlineDate: adjustRequestDeadlineDate || undefined,
    })
    if (!didSend) return
    toast.success(`조정 요청을 보냈어요. (${selectedTodos.length}개)`)
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
      const requestItems = validItems.map((item) => ({
        draftId: item.draftId,
        sourceScheduleId: item.sourceScheduleId,
        body: {
          type: 'TODO' as const,
          title: item.title.trim(),
          description: item.description.trim() || undefined,
          occurrenceDate: item.scheduledDate,
          startAt: item.startAt,
          endAt: item.endAt,
          agentId: effectiveChatAgentId,
        },
      }))

      const createTargets = requestItems

      const createResults = await Promise.allSettled(
        createTargets.map((item) => createSchedule(item.body as ScheduleCreateBodyInterface)),
      )
      const successIndexes = createResults
        .map((result, index) => (result.status === 'fulfilled' ? index : -1))
        .filter((index) => index >= 0)
      const successCount = successIndexes.length
      const failCount = createResults.length - successCount

      const sourceIdsUsedForDelete = new Set<number>()
      let removedOriginalCount = 0
      if (successIndexes.length > 0) {
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
          toast.success(`${successCount}개의 투두를 캘린더에 등록했습니다.`)
        }
        if (sourceIdsUsedForDelete.size > 0) {
          setNegotiationSourceTodoIdsByMessageId((previous) => {
            const nextMap: Record<string, number[]> = {}
            for (const [messageId, sourceIds] of Object.entries(previous)) {
              const remainingIds = sourceIds.filter((id) => !sourceIdsUsedForDelete.has(id))
              if (remainingIds.length > 0) {
                nextMap[messageId] = remainingIds
              }
            }
            return nextMap
          })
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
              onNegotiationSent={(assistantMessageId, sourceTodoIds) => {
                if (!assistantMessageId || sourceTodoIds.length === 0) return
                setNegotiationSourceTodoIdsByMessageId((previous) => ({
                  ...previous,
                  [assistantMessageId]: sourceTodoIds,
                }))
              }}
              onBindNegotiationSender={(sender) => {
                negotiationSenderRef.current = sender
              }}
              onSendPendingChange={setIsChatSendPending}
            />

            <div className="w-md shrink-0 space-y-3">
              <TodoWorkbenchPanel
                todoWorkbenchFilter={todoWorkbenchFilter}
                selectedWorkbenchTodoIds={selectedWorkbenchTodoIds}
                workbenchTodos={workbenchTodos}
                isMonthlySchedulesPending={isMonthlySchedulesPending}
                adjustRequestMessage={adjustRequestMessage}
                adjustRequestDeadlineDate={adjustRequestDeadlineDate}
                isSendPending={isChatSendPending}
                onChangeFilter={setTodoWorkbenchFilter}
                onToggleSelection={handleToggleWorkbenchTodoSelection}
                onSelectAll={handleSelectAllWorkbenchTodos}
                onClearSelection={handleClearWorkbenchSelection}
                onChangeAdjustRequestMessage={setAdjustRequestMessage}
                onChangeAdjustRequestDeadlineDate={setAdjustRequestDeadlineDate}
                onOpenSelectionInEditor={handleOpenWorkbenchSelectionInEditor}
                onSendAdjustRequest={handleRequestTodoNegotiation}
              />

              {todoDraftItems.length > 0 ? (
                todoDraftPanelType === 'ADJUST' ? (
                  <TodoAdjustPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    isTodoRegistering={isTodoRegistering}
                    onClose={handleCloseTodoDraftPanel}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={handleRemoveTodoDraftItem}
                    onAddDraftItem={handleAddTodoDraftItem}
                    onApplyAdjustments={registerTodoDraftItems}
                  />
                ) : (
                  <TodoRegisterPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    isTodoRegistering={isTodoRegistering}
                    onClose={handleCloseTodoDraftPanel}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={handleRemoveTodoDraftItem}
                    onAddDraftItem={handleAddTodoDraftItem}
                    onRegister={registerTodoDraftItems}
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
