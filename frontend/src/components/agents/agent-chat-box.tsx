import { BookmarkPlus, ImagePlusIcon } from 'lucide-react'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import { TodoMessage } from '@/components/chat/todo-message'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCreateAgentPinnedMemory } from '@/hooks/queries/agent-query'
import { useInfiniteAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { getFirebaseStorage } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import type {
  ChatMessageInterface,
  ImageDraftItemInterface,
  NegotiationTodoRequestItemInterface,
} from '@/types/chat.type'
import { toast } from 'sonner'

interface AgentChatBoxPropsInterface {
  agentId: number | null
  chatAgentName?: string
  onOpenSettings: () => void
  onOpenTodoDraftPanel: (message: ChatMessageInterface) => void
  onNegotiationSent?: (assistantMessageId: string, sourceTodoIds: number[]) => void
  onBindNegotiationSender?: (
    sender: (payload: {
      content: string
      negotiationTodos: NegotiationTodoRequestItemInterface[]
      preferredDeadlineDate?: string
    }) => boolean,
  ) => void
  onSendPendingChange?: (isPending: boolean) => void
}

export const AgentChatBox = ({
  agentId,
  chatAgentName,
  onOpenSettings,
  onOpenTodoDraftPanel,
  onNegotiationSent,
  onBindNegotiationSender,
  onSendPendingChange,
}: AgentChatBoxPropsInterface) => {
  const [chatInput, setChatInput] = useState('')
  const [chatMode, setChatMode] = useState<'CHAT' | 'TODO'>('CHAT')
  const [chatImageDrafts, setChatImageDrafts] = useState<ImageDraftItemInterface[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isUploadingChatImages, setIsUploadingChatImages] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatImageInputRef = useRef<HTMLInputElement | null>(null)
  const sendLockRef = useRef(false)
  const lastSentContentRef = useRef<string | null>(null)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)

  const {
    data: chatPages,
    isPending: isChatPending,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteAgentChatHistory(agentId ?? 0)

  const createPinnedMemoryMutation = useCreateAgentPinnedMemory(agentId ?? 0)
  const sendChatMutation = useSendAgentChatMessage(agentId ?? 0, {
    onSettled: () => {
      sendLockRef.current = false
    },
    onError: () => {
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
      onNegotiationSent?.(data.id, sourceTodoIds)
    },
  })

  useEffect(() => {
    onSendPendingChange?.(sendChatMutation.isPending)
  }, [onSendPendingChange, sendChatMutation.isPending])

  useEffect(() => {
    if (!chatScrollRef.current) return
    if (isFetchingNextPage) return

    if (keepScrollOffsetRef.current) {
      const previousScroll = keepScrollOffsetRef.current
      keepScrollOffsetRef.current = null
      const nextHeight = chatScrollRef.current.scrollHeight
      chatScrollRef.current.scrollTop = nextHeight - previousScroll.height + previousScroll.top
      return
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatPages?.pages, isFetchingNextPage])

  const chatMessages: ChatMessageInterface[] = useMemo(() => {
    const pages = chatPages?.pages ?? []
    if (pages.length === 0) return []
    const newestPage = pages[0]
    const olderPages = pages.slice(1)
    const systemItems = newestPage.items.filter((message) => message.role === 'SYSTEM')
    const newestNonSystem = newestPage.items.filter((message) => message.role !== 'SYSTEM')
    const olderChronological = [...olderPages].reverse().flatMap((page) => page.items)
    return [...systemItems, ...olderChronological, ...newestNonSystem]
  }, [chatPages])

  const makeRandomId = (): string => {
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

  useEffect(() => {
    return () => {
      revokeDraftObjectUrls(chatImageDrafts)
    }
  }, [chatImageDrafts])

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
    return uploadedUrls
  }

  const handlePickChatImage: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const inputEl = event.currentTarget
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return
    const maxSizeBytes = 3 * 1024 * 1024
    const maxImageCount = 5
    try {
      const nextDraftItems: ImageDraftItemInterface[] = []
      for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) {
          toast.error('이미지 파일만 첨부할 수 있습니다.')
          continue
        }
        if (file.size > maxSizeBytes) {
          toast.error(`"${file.name}" 용량이 너무 큽니다. 3MB 이하만 가능해요.`)
          continue
        }
        nextDraftItems.push({
          id: `chat-image-${makeRandomId()}`,
          file,
          preview_object_url: URL.createObjectURL(file),
          mime_type: file.type,
        })
      }
      if (nextDraftItems.length === 0) return

      setChatImageDrafts((previous) => {
        const merged = [...previous, ...nextDraftItems]
        if (merged.length <= maxImageCount) return merged
        const overflowItems = merged.slice(maxImageCount)
        revokeDraftObjectUrls(overflowItems)
        toast.error(`이미지는 최대 ${maxImageCount}장까지 첨부할 수 있습니다.`)
        return merged.slice(0, maxImageCount)
      })
      setUploadedImageUrls([])
    } catch {
      toast.error('이미지 미리보기 생성에 실패했습니다.')
    } finally {
      inputEl.value = ''
    }
  }

  const handleClearChatImage = () => {
    setChatImageDrafts((previous) => {
      revokeDraftObjectUrls(previous)
      return []
    })
    setUploadedImageUrls([])
    if (chatImageInputRef.current) chatImageInputRef.current.value = ''
  }

  const handleRemoveChatImageDraft = (draftId: string) => {
    setChatImageDrafts((previous) => {
      const removeTarget = previous.find((draft) => draft.id === draftId)
      if (removeTarget) {
        revokeDraftObjectUrls([removeTarget])
      }
      return previous.filter((draft) => draft.id !== draftId)
    })
  }

  const sendChat = async (payload: {
    content: string
    mode: 'CHAT' | 'TODO' | 'TODO_NEGOTIATION'
    negotiationTodos?: NegotiationTodoRequestItemInterface[]
    preferredDeadlineDate?: string
  }): Promise<boolean> => {
    if (agentId === null) return false
    const content = payload.content.trim()
    if (!content || sendChatMutation.isPending || sendLockRef.current) return false
    sendLockRef.current = true
    lastSentContentRef.current = content
    if (payload.mode !== 'TODO_NEGOTIATION') {
      setChatInput('')
    }

    let imageUrlsToSend: string[] | undefined = undefined
    if (payload.mode !== 'TODO_NEGOTIATION' && chatImageDrafts.length > 0) {
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
        return false
      } finally {
        setIsUploadingChatImages(false)
      }
    }

    sendChatMutation.mutate({
      content,
      mode: payload.mode,
      imageUrls: imageUrlsToSend,
      negotiationTodos: payload.negotiationTodos,
      preferredDeadlineDate: payload.preferredDeadlineDate,
    })
    return true
  }

  const sendNegotiationRequest = useCallback(
    (payload: {
      content: string
      negotiationTodos: NegotiationTodoRequestItemInterface[]
      preferredDeadlineDate?: string
    }): boolean => {
      if (agentId === null) return false
      const content = payload.content.trim()
      if (!content || sendChatMutation.isPending || sendLockRef.current) return false
      sendLockRef.current = true
      lastSentContentRef.current = content
      sendChatMutation.mutate({
        content,
        mode: 'TODO_NEGOTIATION',
        negotiationTodos: payload.negotiationTodos,
        preferredDeadlineDate: payload.preferredDeadlineDate,
      })
      return true
    },
    [agentId, sendChatMutation],
  )

  useEffect(() => {
    if (!onBindNegotiationSender) return
    onBindNegotiationSender(sendNegotiationRequest)
  }, [onBindNegotiationSender, sendNegotiationRequest])

  const handleSendChat = () => {
    void sendChat({ content: chatInput, mode: chatMode })
  }

  const handleChatInputKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendChat()
    }
  }

  const handleChatScroll: React.UIEventHandler<HTMLDivElement> = async (event) => {
    const element = event.currentTarget
    if (element.scrollTop > 80) return
    if (!hasNextPage || isFetchingNextPage) return
    keepScrollOffsetRef.current = { top: element.scrollTop, height: element.scrollHeight }
    await fetchNextPage()
  }

  return (
    <Card className="w-full min-w-0 min-h-0">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{chatAgentName ?? '에이전트 채팅'}</h2>
            <p className="text-xs text-muted-foreground">
              선택한 에이전트와 개별적으로 대화할 수 있습니다.
            </p>
          </div>
          <Button type="button" size="xs" variant="outline" onClick={onOpenSettings}>
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
            <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
          ) : chatMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
            </p>
          ) : (
            chatMessages.map((message) => {
              const is_user = message.role === 'USER'
              const is_assistant = message.role === 'ASSISTANT'
              const todo_items = message.todo?.filter(Boolean) ?? []
              const message_image_urls = (message.imageUrls ?? []).filter((image_url) =>
                Boolean(image_url),
              )

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex w-full items-end gap-2',
                    is_user ? 'justify-end' : 'justify-start',
                  )}
                >
                  {is_user && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      className="shrink-0"
                      title="메모리 저장"
                      aria-label="메모리 저장"
                      onClick={() =>
                        createPinnedMemoryMutation.mutate({ content: message.content })
                      }
                      disabled={createPinnedMemoryMutation.isPending || !agentId}
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
                                  onClick={() => onOpenTodoDraftPanel(message)}
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
                  {!is_user && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      className="shrink-0"
                      title="메모리 저장"
                      aria-label="메모리 저장"
                      onClick={() =>
                        createPinnedMemoryMutation.mutate({ content: message.content })
                      }
                      disabled={createPinnedMemoryMutation.isPending || !agentId}
                    >
                      <BookmarkPlus />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            multiple
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
              <p className="text-[11px] text-muted-foreground">최대 5장 첨부 (미리보기)</p>
            )}
          </div>

          {chatImageDrafts.length > 0 ? (
            <div className="space-y-2 rounded-md border bg-card p-2">
              <div className="grid grid-cols-2 gap-2">
                {chatImageDrafts.map((draft) => (
                  <div key={draft.id} className="rounded border p-1">
                    <img
                      src={draft.preview_object_url}
                      alt="이미지 미리보기"
                      className="h-20 w-full rounded object-cover"
                    />
                    <p className="mt-1 text-[11px] font-medium line-clamp-1">{draft.file.name}</p>
                    <div className="mt-1 flex justify-end">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => handleRemoveChatImageDraft(draft.id)}
                        disabled={isUploadingChatImages}
                      >
                        제거
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleClearChatImage}
                  disabled={isUploadingChatImages}
                >
                  전체 제거
                </Button>
              </div>
            </div>
          ) : null}

          <Textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatInputKeyDown}
            rows={3}
            placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
          />
          <div className="flex items-center justify-between gap-2">
            <Select
              value={chatMode}
              onValueChange={(value) => setChatMode(value as 'CHAT' | 'TODO')}
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
                disabled={!chatInput.trim() || sendChatMutation.isPending || isUploadingChatImages}
              >
                보내기
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
