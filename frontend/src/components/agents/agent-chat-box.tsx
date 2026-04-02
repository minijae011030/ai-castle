import { BookmarkPlus, ChevronDown, ChevronUp, ImagePlusIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import { TodoMessage } from '@/components/chat/todo-message'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAgentChatStream } from '@/hooks/useAgentChatStream'
import { useCreateAgentPinnedMemory } from '@/hooks/queries/agent-query'
import { useInfiniteAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { cn } from '@/lib/utils'
import type { ChatMessageInterface, ImageDraftItemInterface } from '@/types/chat.type'
import { toast } from 'sonner'

const ProgressNotes = ({ notes, messageId }: { notes: string[]; messageId: string }) => {
  const [open, setOpen] = useState(false)
  const lastNote = notes[notes.length - 1]

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        {open ? '단계 숨기기' : lastNote}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {notes.map((note) => (
            <p key={`${messageId}-${note}`} className="text-[11px] text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

interface AgentChatBoxPropsInterface {
  agentId: number | null
  chatAgentName?: string
  onOpenSettings: () => void
  onOpenTodoDraftPanel: (message: ChatMessageInterface) => void
  onSendPendingChange?: (isPending: boolean) => void
}

export const AgentChatBox = ({
  agentId,
  chatAgentName,
  onOpenSettings,
  onOpenTodoDraftPanel,
  onSendPendingChange,
}: AgentChatBoxPropsInterface) => {
  const [chatInput, setChatInput] = useState('')
  const [chatImageDrafts, setChatImageDrafts] = useState<ImageDraftItemInterface[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const isUploadingChatImages = false
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatImageInputRef = useRef<HTMLInputElement | null>(null)
  const sendLockRef = useRef(false)
  const lastSentContentRef = useRef<string | null>(null)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)
  const { isStreamingReply, sendStreamMessage } = useAgentChatStream({ agentId })

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
    onSuccess: () => {
      lastSentContentRef.current = null
    },
  })

  useEffect(() => {
    onSendPendingChange?.(sendChatMutation.isPending || isStreamingReply)
  }, [isStreamingReply, onSendPendingChange, sendChatMutation.isPending])

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

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string' || !result.startsWith('data:image/')) {
          reject(new Error('이미지 data URL 변환 실패'))
          return
        }
        resolve(result)
      }
      reader.onerror = () => reject(new Error('파일 읽기 실패'))
      reader.readAsDataURL(file)
    })

  const sendChat = async (payload: {
    content: string
    mode?: 'CHAT' | 'TODO'
  }): Promise<boolean> => {
    if (agentId === null) return false
    const content = payload.content.trim()
    const hasImages = chatImageDrafts.length > 0
    if (
      (!content && !hasImages) ||
      sendChatMutation.isPending ||
      sendLockRef.current ||
      isStreamingReply
    )
      return false

    let dataImageUrls: string[] = []
    if (hasImages) {
      try {
        dataImageUrls = await Promise.all(chatImageDrafts.map((draft) => fileToDataUrl(draft.file)))
      } catch {
        toast.error('이미지 변환에 실패했습니다. 이미지를 다시 선택해 주세요.')
        return false
      }
    }

    sendLockRef.current = true
    lastSentContentRef.current = content
    const ok = await sendStreamMessage({
      content,
      mode: payload.mode,
      imageUrls: dataImageUrls,
      onBeforeStart: () => setChatInput(''),
      onSuccess: () => {
        lastSentContentRef.current = null
        handleClearChatImage()
      },
      onFailureRestore: () => {
        setChatInput(content)
      },
    })
    sendLockRef.current = false
    return ok
  }

  const handleSendChat = () => {
    void sendChat({ content: chatInput })
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
              const progress_notes = (message.progressNotes ?? []).filter((note) => Boolean(note))

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
                    {is_assistant && progress_notes.length > 0 ? (
                      <ProgressNotes notes={progress_notes} messageId={message.id} />
                    ) : null}
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
          <div className="flex items-center justify-end gap-2">
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
                (!chatInput.trim() && chatImageDrafts.length === 0) ||
                sendChatMutation.isPending ||
                isUploadingChatImages ||
                isStreamingReply
              }
            >
              보내기
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
