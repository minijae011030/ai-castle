import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TodoAdjustPanel } from '@/components/agents/todo-adjust-panel'
import { TodoRegisterPanel } from '@/components/agents/todo-register-panel'
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
import {
  useAgentPinnedMemoryList,
  useAgentRoleList,
  useCreateAgentPinnedMemory,
  useCreateAgentRole,
  useDeleteAgentPinnedMemory,
  useUpdateAgentPinnedMemory,
  useUpdateAgentRole,
} from '@/hooks/queries/agent-query'
import { useInfiniteAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { useSchedulesByMonth } from '@/hooks/queries/schedule-query'
import { createSchedule, deleteSchedule } from '@/services/schedule-service'
import { getFirebaseStorage } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import type {
  ChatMessageInterface,
  ImageDraftItemInterface,
  NegotiationTodoRequestItemInterface,
} from '@/types/chat.type'
import type { ScheduleOccurrenceInterface } from '@/types/schedule.type'
import type { ScheduleCreateBodyInterface } from '@/types/schedule.type'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { BookmarkPlus, ImagePlusIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import { TodoMessage } from '@/components/chat/todo-message'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const emptyForm = {
  name: '',
  roleType: 'SUB' as 'MAIN' | 'SUB',
  systemPrompt: '',
}

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

type TodoWorkbenchDateFilterType = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'
type TodoDraftPanelType = 'REGISTER' | 'ADJUST'

export const AgentListPage = () => {
  const queryClient = useQueryClient()
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [chatAgentId, setChatAgentId] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMode, setChatMode] = useState<'CHAT' | 'TODO'>('CHAT')
  const [chatImageDrafts, setChatImageDrafts] = useState<ImageDraftItemInterface[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isUploadingChatImages, setIsUploadingChatImages] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null)
  const [editingMemoryContent, setEditingMemoryContent] = useState('')
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

  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const sendLockRef = useRef(false)
  const lastSentContentRef = useRef<string | null>(null)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)
  const chatImageInputRef = useRef<HTMLInputElement | null>(null)

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

  const {
    data: chatPages,
    isPending: isChatPending,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteAgentChatHistory(effectiveChatAgentId ?? 0)

  const createMutation = useCreateAgentRole()
  const updateMutation = useUpdateAgentRole()
  const createPinnedMemoryMutation = useCreateAgentPinnedMemory(effectiveChatAgentId ?? 0)
  const { data: pinnedMemoryItems = [], isPending: isPinnedMemoryPending } =
    useAgentPinnedMemoryList(selectedAgentId ?? 0)
  const deletePinnedMemoryMutation = useDeleteAgentPinnedMemory(selectedAgentId ?? 0)
  const updatePinnedMemoryMutation = useUpdateAgentPinnedMemory(selectedAgentId ?? 0)
  const sendChatMutation = useSendAgentChatMessage(effectiveChatAgentId ?? 0, {
    onSettled: () => {
      sendLockRef.current = false
    },
    onError: () => {
      // 전송 실패 시, 사용자가 입력한 내용을 복구 (이미 다른 입력을 시작했다면 방해하지 않음)
      if (!chatInput.trim() && lastSentContentRef.current) {
        setChatInput(lastSentContentRef.current)
      }
      lastSentContentRef.current = null
    },
    onSuccess: (data, variables) => {
      lastSentContentRef.current = null
      if (variables.mode !== 'TODO_NEGOTIATION') return
      const sourceTodoIds =
        variables.negotiationTodos
          ?.map((todo) => todo.scheduleId)
          .filter((id) => typeof id === 'number') ?? []
      if (!data?.id || sourceTodoIds.length === 0) return
      setNegotiationSourceTodoIdsByMessageId((previous) => ({
        ...previous,
        [data.id]: sourceTodoIds,
      }))
    },
  })

  useEffect(() => {
    if (!chatScrollRef.current) return
    if (isFetchingNextPage) return

    if (keepScrollOffsetRef.current) {
      const prev = keepScrollOffsetRef.current
      keepScrollOffsetRef.current = null
      const nextHeight = chatScrollRef.current.scrollHeight
      chatScrollRef.current.scrollTop = nextHeight - prev.height + prev.top
      return
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatPages?.pages?.length, chatPages?.pages?.[0]?.items?.length, isFetchingNextPage])

  const chatMessages: ChatMessageInterface[] = useMemo(() => {
    const pages = chatPages?.pages ?? []
    if (pages.length === 0) return []

    const newestPage = pages[0]
    const olderPages = pages.slice(1)
    const systemItems = newestPage.items.filter((m) => m.role === 'SYSTEM')
    const newestNonSystem = newestPage.items.filter((m) => m.role !== 'SYSTEM')
    const olderChrono = [...olderPages].reverse().flatMap((p) => p.items)

    return [...systemItems, ...olderChrono, ...newestNonSystem]
  }, [chatPages])

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
    if (effectiveChatAgentId === null || sendChatMutation.isPending || sendLockRef.current) {
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

    sendLockRef.current = true
    sendChatMutation.mutate({
      content: requestContent,
      mode: 'TODO_NEGOTIATION',
      negotiationTodos,
      preferredDeadlineDate: adjustRequestDeadlineDate || undefined,
    })
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

  const handleChatScroll: React.UIEventHandler<HTMLDivElement> = async (event) => {
    const el = event.currentTarget
    if (el.scrollTop > 80) return
    if (!hasNextPage || isFetchingNextPage) return

    keepScrollOffsetRef.current = { top: el.scrollTop, height: el.scrollHeight }
    await fetchNextPage()
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

    if (selectedAgentId === null) {
      await createMutation.mutateAsync({
        name,
        roleType: form.roleType,
        systemPrompt: systemPrompt,
      })
      setForm(emptyForm)
    } else {
      await updateMutation.mutateAsync({
        id: selectedAgentId,
        body: {
          systemPrompt: systemPrompt,
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
    })
  }

  const makeRandomId = (): string => {
    // Safari/환경에 따라 randomUUID 미지원이 있을 수 있어 방어적으로 처리
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const revokeDraftObjectUrls = (drafts: Array<{ preview_object_url: string }>) => {
    for (const draft of drafts) {
      if (!draft.preview_object_url) continue
      URL.revokeObjectURL(draft.preview_object_url)
    }
  }

  const handlePickChatImage: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const inputEl = event.currentTarget
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 첨부할 수 있습니다.')
      return
    }

    const maxSizeBytes = 3 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast.error('이미지 용량이 너무 큽니다. 3MB 이하로 올려주세요.')
      return
    }

    try {
      const preview_object_url = URL.createObjectURL(file)
      setChatImageDrafts((previous) => {
        revokeDraftObjectUrls(previous)
        return [
          {
            id: `chat-image-${makeRandomId()}`,
            file,
            preview_object_url,
            mime_type: file.type,
          },
        ]
      })
      setUploadedImageUrls([])
    } catch {
      toast.error('이미지 미리보기 생성에 실패했습니다.')
    } finally {
      // 같은 파일을 다시 선택해도 onChange가 동작하도록 초기화
      inputEl.value = ''
    }
  }

  const uploadChatImagesToFirebase = async (): Promise<string[]> => {
    if (chatImageDrafts.length === 0) return []

    const storage = getFirebaseStorage()
    const uploadedUrls: string[] = []

    for (const draft of chatImageDrafts) {
      const ext = draft.mime_type.split('/')[1] || 'png'
      const objectPath = `chat_images/${makeRandomId()}.${ext}`

      const fileRef = storageRef(storage, objectPath)
      await uploadBytes(fileRef, draft.file, { contentType: draft.mime_type })
      const downloadUrl = await getDownloadURL(fileRef)
      uploadedUrls.push(downloadUrl)
    }

    // objectPath는 추후 objectPath 저장/삭제 정책으로 확장 가능
    return uploadedUrls
  }

  // 채팅 전송 버튼 클릭 핸들러
  const handleSendChat = async () => {
    if (effectiveChatAgentId === null) return
    const content = chatInput.trim()
    if (!content || sendChatMutation.isPending || sendLockRef.current) return
    sendLockRef.current = true
    lastSentContentRef.current = content
    setChatInput('') // 엔터/전송 즉시 입력창 비우기

    let imageUrlsToSend: string[] | undefined = undefined

    if (chatImageDrafts.length > 0) {
      setIsUploadingChatImages(true)
      try {
        const urls = await uploadChatImagesToFirebase()
        imageUrlsToSend = urls
        setUploadedImageUrls(urls)
        setChatImageDrafts((previous) => {
          revokeDraftObjectUrls(previous)
          return []
        })
      } catch {
        toast.error('이미지 업로드에 실패했습니다.')
        setChatInput(content)
        lastSentContentRef.current = null
        sendLockRef.current = false
        return
      } finally {
        setIsUploadingChatImages(false)
      }
    }

    sendChatMutation.mutate({ content, mode: chatMode, imageUrls: imageUrlsToSend })
  }

  useEffect(() => {
    return () => {
      revokeDraftObjectUrls(chatImageDrafts)
    }
  }, [chatImageDrafts])

  // 채팅 입력창 엔터키 누르면 전송 핸들러
  const handleChatKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    // 한글 입력(IME) 조합 중 Enter는 전송으로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendChat()
    }
  }

  // 채팅 메시지 렌더링 핸들러
  const renderChatMessage = (message: ChatMessageInterface) => {
    const is_user = message.role === 'USER'
    const is_assistant = message.role === 'ASSISTANT'
    const can_save_memory = is_user || is_assistant
    const todo_items = message.todo?.filter(Boolean) ?? []
    const message_image_urls = (message.imageUrls ?? []).filter((image_url) => Boolean(image_url))

    return (
      <div
        key={message.id}
        className={cn('flex w-full items-end gap-2', is_user ? 'justify-end' : 'justify-start')}
      >
        {is_user && can_save_memory && (
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="shrink-0"
            title="메모리 저장"
            aria-label="메모리 저장"
            onClick={() => createPinnedMemoryMutation.mutate({ content: message.content })}
            disabled={createPinnedMemoryMutation.isPending || !effectiveChatAgentId}
          >
            <BookmarkPlus />
          </Button>
        )}
        <div className="max-w-[70%]">
          {is_user && message_image_urls.length > 0 ? (
            <div className="mb-2 grid grid-cols-2 gap-2">
              {message_image_urls.map((image_url) => (
                <a
                  key={`${message.id}-${image_url}`}
                  href={image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <img
                    src={image_url}
                    alt="첨부 이미지"
                    className="h-28 w-full rounded border object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ) : null}
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-xs',
              is_user
                ? 'bg-primary text-primary-foreground'
                : is_assistant
                  ? 'bg-muted text-foreground'
                  : 'bg-secondary text-secondary-foreground',
            )}
          >
            {is_user ? (
              <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
            ) : (
              <>
                <MarkdownMessage content={message.content} />
                {todo_items.length > 0 ? (
                  <>
                    <TodoMessage items={todo_items} />
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => openTodoDraftPanel(message)}
                      >
                        투두 편집 패널로 열기
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
        {!is_user && can_save_memory && (
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="shrink-0"
            title="메모리 저장"
            aria-label="메모리 저장"
            onClick={() => createPinnedMemoryMutation.mutate({ content: message.content })}
            disabled={createPinnedMemoryMutation.isPending || !effectiveChatAgentId}
          >
            <BookmarkPlus />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      <div className="flex w-72 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">에이전트 목록</h2>
          <Button size="xs" variant="outline" onClick={handleChangeNew}>
            + 새 에이전트
          </Button>
        </div>
        <div className="flex-1 overflow-auto rounded border bg-card">
          {isPending ? (
            <p className="p-3 text-xs text-muted-foreground">에이전트를 불러오는 중입니다...</p>
          ) : agents.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              등록된 에이전트가 없습니다. 우측에서 새 에이전트를 추가해 보세요.
            </p>
          ) : (
            <ul className="divide-y">
              {agents.map((agent) => {
                const is_active = effectiveSelectedAgentId === agent.id
                return (
                  <li key={agent.id}>
                    <div
                      className={cn(
                        'flex flex-1 justify-between p-3 items-start gap-1 text-left text-sm',
                        is_active ? 'bg-primary/10' : 'bg-background',
                      )}
                      onClick={() => handleOpenChat(agent)}
                    >
                      {agent.name}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1">
        {isSettingsOpen || effectiveChatAgentId === null ? (
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
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
                    onClick={() => setForm((prev) => ({ ...prev, roleType: 'MAIN' }))}
                    disabled={selectedAgentId !== null}
                  >
                    메인 에이전트
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={form.roleType === 'SUB' ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, roleType: 'SUB' }))}
                    disabled={selectedAgentId !== null}
                  >
                    서브 에이전트
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agent-system-prompt">시스템 프롬프트</Label>
                <Textarea
                  id="agent-system-prompt"
                  value={form.systemPrompt}
                  onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="이 에이전트가 어떤 역할/말투/전략으로 답할지 작성해 주세요."
                  rows={10}
                />
                <p className="text-[11px] text-muted-foreground">
                  예: &quot;너는 코딩 테스트 과외 선생님이다. 항상 단계별 풀이와 시간 복잡도를
                  설명한다.&quot;
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                  {selectedAgentId === null ? '에이전트 생성' : '프롬프트 저장'}
                </Button>
              </div>
              {selectedAgentId !== null && (
                <div className="grid gap-2">
                  <Label>저장된 메모리</Label>
                  <div className="flex flex-col gap-2 max-h-[600px] overflow-auto">
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
                                  onClick={() => {
                                    setEditingMemoryId(null)
                                    setEditingMemoryContent('')
                                  }}
                                  disabled={updatePinnedMemoryMutation.isPending}
                                >
                                  취소
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={() => {
                                    const content = editingMemoryContent.trim()
                                    if (!content) return
                                    updatePinnedMemoryMutation.mutate(
                                      {
                                        memory_id: memory.id,
                                        body: { content },
                                      },
                                      {
                                        onSuccess: () => {
                                          setEditingMemoryId(null)
                                          setEditingMemoryContent('')
                                        },
                                      },
                                    )
                                  }}
                                  disabled={updatePinnedMemoryMutation.isPending}
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
                                  onClick={() => {
                                    setEditingMemoryId(memory.id)
                                    setEditingMemoryContent(memory.content)
                                  }}
                                  disabled={
                                    deletePinnedMemoryMutation.isPending ||
                                    updatePinnedMemoryMutation.isPending
                                  }
                                >
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    deletePinnedMemoryMutation.mutate({ memory_id: memory.id })
                                  }
                                  disabled={
                                    deletePinnedMemoryMutation.isPending ||
                                    updatePinnedMemoryMutation.isPending
                                  }
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
        ) : (
          <div className="flex w-full gap-4">
            <Card className="w-full max-w-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {agents.find((a) => a.id === effectiveChatAgentId)?.name ?? '에이전트 대화'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    선택한 에이전트와 개별적으로 대화할 수 있습니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      const target = agents.find((a) => a.id === effectiveChatAgentId) ?? null
                      if (target) {
                        handleSelectAgentForSettings(target)
                      } else {
                        setIsSettingsOpen(true)
                      }
                    }}
                  >
                    에이전트 설정
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
                <div
                  ref={chatScrollRef}
                  className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3 max-h-[min(1000px,calc(100dvh-320px))]"
                  onScroll={handleChatScroll}
                >
                  {isChatPending ? (
                    <p className="text-xs text-muted-foreground">
                      대화 내역을 불러오는 중입니다...
                    </p>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
                    </p>
                  ) : (
                    chatMessages.map(renderChatMessage)
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={chatImageInputRef}
                    style={{ display: 'none' }}
                    onChange={handlePickChatImage}
                  />

                  <div className="flex items-center justify-end gap-2">
                    {isUploadingChatImages ? (
                      <p className="text-[11px] text-muted-foreground">업로드 중...</p>
                    ) : chatImageDrafts.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground">미리보기 준비됨</p>
                    ) : uploadedImageUrls.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        최근 업로드 URL 확보됨 ({uploadedImageUrls.length})
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">1장만 첨부 (미리보기)</p>
                    )}
                  </div>

                  {chatImageDrafts.length > 0 ? (
                    <div className="flex items-start gap-2 rounded-md border bg-card p-2">
                      <img
                        src={chatImageDrafts[0]?.preview_object_url}
                        alt="이미지 미리보기"
                        className="h-20 w-20 rounded border object-cover"
                      />
                      <div className="flex flex-1 flex-col">
                        <p className="text-xs font-medium line-clamp-2">
                          {chatImageDrafts[0]?.file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground break-all">
                          {chatImageDrafts[0]?.mime_type}
                        </p>
                        <div className="mt-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setChatImageDrafts((previous) => {
                                revokeDraftObjectUrls(previous)
                                return []
                              })
                              setUploadedImageUrls([])
                              if (chatImageInputRef.current) chatImageInputRef.current.value = ''
                            }}
                            disabled={isUploadingChatImages}
                          >
                            이미지 제거
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <Textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    rows={3}
                    placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Select
                      value={chatMode}
                      onValueChange={(v) => setChatMode(v as 'CHAT' | 'TODO')}
                    >
                      <SelectTrigger size="sm" className="min-w-24">
                        <SelectValue placeholder="모드" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHAT">Chat</SelectItem>
                        <SelectItem value="TODO">Todo</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => chatImageInputRef.current?.click()}
                        disabled={isUploadingChatImages}
                      >
                        <ImagePlusIcon size={3} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendChat}
                        disabled={
                          !chatInput.trim() || sendChatMutation.isPending || isUploadingChatImages
                        }
                      >
                        보내기
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="w-md shrink-0 space-y-3">
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">TODO 워크벤치</h3>
                    <Select
                      value={todoWorkbenchFilter}
                      onValueChange={(value) =>
                        setTodoWorkbenchFilter(value as TodoWorkbenchDateFilterType)
                      }
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
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={handleSelectAllWorkbenchTodos}
                      >
                        전체 선택
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={handleClearWorkbenchSelection}
                      >
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
                              onChange={(event) =>
                                handleToggleWorkbenchTodoSelection(todo.id, event.target.checked)
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium wrap-break-word">{todo.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {todo.occurrenceDate} {todo.startAt.slice(11, 16)}-
                                {todo.endAt.slice(11, 16)}
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
                      onChange={(event) => setAdjustRequestMessage(event.target.value)}
                      placeholder="예: 선택한 일정이 너무 빡빡해요. 다음주 수요일까지 끝낼 수 있게 조정해주세요."
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">희망 완료 기한 (선택)</p>
                      <Input
                        type="date"
                        value={adjustRequestDeadlineDate}
                        onChange={(event) => setAdjustRequestDeadlineDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={handleOpenWorkbenchSelectionInEditor}
                      disabled={selectedWorkbenchTodoIds.length === 0}
                    >
                      선택 항목 편집 패널로 열기
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRequestTodoNegotiation}
                      disabled={selectedWorkbenchTodoIds.length === 0 || sendChatMutation.isPending}
                    >
                      조정 요청 채팅 보내기
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {todoDraftItems.length > 0 ? (
                todoDraftPanelType === 'ADJUST' ? (
                  <TodoAdjustPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    isTodoRegistering={isTodoRegistering}
                    onClose={() => {
                      setTodoDraftItems([])
                      setTodoDraftSourceMessageId(null)
                      setTodoDraftPanelType('REGISTER')
                    }}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={(draftId) => {
                      setTodoDraftItems((previous) =>
                        previous.filter((draftItem) => draftItem.draftId !== draftId),
                      )
                    }}
                    onAddDraftItem={() =>
                      setTodoDraftItems((previous) => [...previous, buildEmptyDraftItem()])
                    }
                    onApplyAdjustments={registerTodoDraftItems}
                  />
                ) : (
                  <TodoRegisterPanel
                    sourceMessageId={todoDraftSourceMessageId}
                    draftItems={todoDraftItems}
                    isTodoRegistering={isTodoRegistering}
                    onClose={() => {
                      setTodoDraftItems([])
                      setTodoDraftSourceMessageId(null)
                      setTodoDraftPanelType('REGISTER')
                    }}
                    onUpdateDraftItem={updateTodoDraftItem}
                    onRemoveDraftItem={(draftId) => {
                      setTodoDraftItems((previous) =>
                        previous.filter((draftItem) => draftItem.draftId !== draftId),
                      )
                    }}
                    onAddDraftItem={() =>
                      setTodoDraftItems((previous) => [...previous, buildEmptyDraftItem()])
                    }
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
