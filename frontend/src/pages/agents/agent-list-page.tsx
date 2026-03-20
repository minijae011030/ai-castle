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
import { createSchedule } from '@/services/schedule-service'
import { getFirebaseStorage } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import type { AgentRoleDataInterface } from '@/types/agent.type'
import type { ChatMessageInterface } from '@/types/chat.type'
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

export const AgentListPage = () => {
  const queryClient = useQueryClient()
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [chatAgentId, setChatAgentId] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMode, setChatMode] = useState<'CHAT' | 'TODO'>('CHAT')
  const [chatImageDrafts, setChatImageDrafts] = useState<
    Array<{ id: string; file: File; preview_data_url: string; mime_type: string }>
  >([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isUploadingChatImages, setIsUploadingChatImages] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null)
  const [editingMemoryContent, setEditingMemoryContent] = useState('')
  const [todoDraftItems, setTodoDraftItems] = useState<TodoDraftItemInterface[]>([])
  const [todoDraftSourceMessageId, setTodoDraftSourceMessageId] = useState<string | null>(null)
  const [isTodoRegistering, setIsTodoRegistering] = useState(false)

  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const sendLockRef = useRef(false)
  const lastSentContentRef = useRef<string | null>(null)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)
  const chatImageInputRef = useRef<HTMLInputElement | null>(null)

  const { data: agents = [], isPending } = useAgentRoleList()

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
    onSuccess: () => {
      lastSentContentRef.current = null
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

  const buildEmptyDraftItem = (): TodoDraftItemInterface => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const baseDate = `${yyyy}-${mm}-${dd}`
    return {
      draftId: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
    setTodoDraftSourceMessageId(message.id)
    setTodoDraftItems(
      sourceItems.map((item, index) => ({
        draftId: `${message.id}-${index}`,
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
      const requests: ScheduleCreateBodyInterface[] = validItems.map((item) => ({
        type: 'TODO',
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        occurrenceDate: item.scheduledDate,
        startAt: item.startAt,
        endAt: item.endAt,
        agentId: effectiveChatAgentId,
      }))

      const results = await Promise.allSettled(requests.map((body) => createSchedule(body)))
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failCount = results.length - successCount

      if (successCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ['schedule'] })
      }

      if (failCount === 0) {
        toast.success(`${successCount}개의 투두를 캘린더에 등록했습니다.`)
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

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'))
      reader.readAsDataURL(file)
    })
  }

  const makeRandomId = (): string => {
    // Safari/환경에 따라 randomUUID 미지원이 있을 수 있어 방어적으로 처리
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
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
      const preview_data_url = await fileToDataUrl(file)
      setChatImageDrafts([
        {
          id: `chat-image-${makeRandomId()}`,
          file,
          preview_data_url,
          mime_type: file.type,
        },
      ])
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
        setChatImageDrafts([])
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
        <div
          className={cn(
            'max-w-[70%] rounded-lg px-3 py-2 text-xs',
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
                        src={chatImageDrafts[0]?.preview_data_url}
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
                              setChatImageDrafts([])
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

            {todoDraftItems.length > 0 ? (
              <Card className="w-md shrink-0">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">투두 편집 패널</h3>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setTodoDraftItems([])
                        setTodoDraftSourceMessageId(null)
                      }}
                    >
                      닫기
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    메시지 #{todoDraftSourceMessageId}에서 가져온 투두입니다. 수정/부분 삭제 후
                    등록하세요.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="max-h-[min(1000px,calc(100dvh-270px))] space-y-2 overflow-auto pr-1">
                    {todoDraftItems.map((item) => (
                      <div key={item.draftId} className="space-y-2 rounded-md border p-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(event) => {
                                updateTodoDraftItem(item.draftId, (previous) => ({
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
                            onClick={() => {
                              setTodoDraftItems((previous) =>
                                previous.filter((draftItem) => draftItem.draftId !== item.draftId),
                              )
                            }}
                          >
                            삭제
                          </Button>
                        </div>

                        <Input
                          value={item.title}
                          onChange={(event) =>
                            updateTodoDraftItem(item.draftId, (previous) => ({
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
                            updateTodoDraftItem(item.draftId, (previous) => ({
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
                              updateTodoDraftItem(item.draftId, (previous) => {
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
                              updateTodoDraftItem(item.draftId, (previous) => ({
                                ...previous,
                                startAt: `${previous.scheduledDate}T${event.target.value}:00`,
                              }))
                            }
                          />
                          <Input
                            type="time"
                            value={item.endAt.slice(11, 16)}
                            onChange={(event) =>
                              updateTodoDraftItem(item.draftId, (previous) => ({
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
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setTodoDraftItems((previous) => [...previous, buildEmptyDraftItem()])
                      }
                    >
                      + 항목 추가
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={registerTodoDraftItems}
                      disabled={isTodoRegistering}
                    >
                      선택 항목 캘린더 등록
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
