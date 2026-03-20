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
import { useInfiniteAgentChatHistory, useSendAgentChatMessage } from '@/hooks/queries/chat-query'
import { useAgentRoleList, useCreateAgentPinnedMemory } from '@/hooks/queries/agent-query'
import type { ChatMessageInterface } from '@/types/chat.type'
import { BookmarkPlus } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Route } from '@/routes/_protected/agents/$agentId.chat'
import { cn } from '@/lib/utils'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import { TodoMessage } from '@/components/chat/todo-message'
import { getFirebaseStorage } from '@/lib/firebase'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { toast } from 'sonner'

export const AgentChatPage = () => {
  const params = Route.useParams()
  const router = useRouter()

  const agentId = Number(params.agentId)

  const { data: agents = [] } = useAgentRoleList()
  const {
    data: chatPages,
    isPending,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteAgentChatHistory(agentId)

  const agent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId])
  const [inputValue, setInputValue] = useState('')
  const [chatMode, setChatMode] = useState<'CHAT' | 'TODO'>('CHAT')
  const [chatImageDrafts, setChatImageDrafts] = useState<
    Array<{ id: string; file: File; preview_data_url: string; mime_type: string }>
  >([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isUploadingChatImages, setIsUploadingChatImages] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sendLockRef = useRef(false)
  const keepScrollOffsetRef = useRef<{ top: number; height: number } | null>(null)
  const chatImageInputRef = useRef<HTMLInputElement | null>(null)

  const sendMutation = useSendAgentChatMessage(agentId, {
    onSettled: () => {
      sendLockRef.current = false
    },
  })
  const createPinnedMemoryMutation = useCreateAgentPinnedMemory(agentId)

  // 에이전트 ID 유효성 검사
  useEffect(() => {
    if (!agentId || Number.isNaN(agentId)) {
      router.navigate({ to: '/agents' })
    }
  }, [agentId, router])

  // 채팅 스크롤 핸들러
  useEffect(() => {
    if (!scrollRef.current) return
    if (isFetchingNextPage) return

    // 과거 메시지 prepend 후에는 기존 위치를 보존한다.
    if (keepScrollOffsetRef.current) {
      const prev = keepScrollOffsetRef.current
      keepScrollOffsetRef.current = null
      const nextHeight = scrollRef.current.scrollHeight
      scrollRef.current.scrollTop = nextHeight - prev.height + prev.top
      return
    }

    // 기본 동작: 최신 메시지 도착 시 바닥으로 스크롤
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatPages?.pages?.length, chatPages?.pages?.[0]?.items?.length, isFetchingNextPage])

  const messages: ChatMessageInterface[] = useMemo(() => {
    const pages = chatPages?.pages ?? []
    if (pages.length === 0) return []

    const newestPage = pages[0]
    const olderPages = pages.slice(1)
    const systemItems = newestPage.items.filter((m) => m.role === 'SYSTEM')
    const newestNonSystem = newestPage.items.filter((m) => m.role !== 'SYSTEM')
    const olderChrono = [...olderPages].reverse().flatMap((p) => p.items)

    return [...systemItems, ...olderChrono, ...newestNonSystem]
  }, [chatPages])

  const handleScroll: React.UIEventHandler<HTMLDivElement> = async (event) => {
    const el = event.currentTarget
    if (el.scrollTop > 80) return
    if (!hasNextPage || isFetchingNextPage) return

    keepScrollOffsetRef.current = { top: el.scrollTop, height: el.scrollHeight }
    await fetchNextPage()
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

    return uploadedUrls
  }

  // 채팅 전송 핸들러
  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || sendMutation.isPending || sendLockRef.current) return

    setInputValue('')
    sendLockRef.current = true

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
        setInputValue(content)
        sendLockRef.current = false
        return
      } finally {
        setIsUploadingChatImages(false)
      }
    }

    sendMutation.mutate({ content, mode: chatMode, imageUrls: imageUrlsToSend })
  }

  // 채팅 입력창 엔터키 누르면 전송 핸들러
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    // 한글 입력(IME) 조합 중 Enter는 전송으로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  // 채팅 메시지 렌더링 핸들러
  const renderMessage = (message: ChatMessageInterface) => {
    const isUser = message.role === 'USER'
    const isAssistant = message.role === 'ASSISTANT'
    const canSaveMemory = isUser || isAssistant
    const todo_items = message.todo?.filter(Boolean) ?? []

    return (
      <div
        key={message.id}
        className={cn('flex w-full items-end gap-2', isUser ? 'justify-end' : 'justify-start')}
      >
        {!isUser && canSaveMemory && (
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="shrink-0"
            title="메모리 저장"
            aria-label="메모리 저장"
            onClick={() => createPinnedMemoryMutation.mutate({ content: message.content })}
            disabled={createPinnedMemoryMutation.isPending}
          >
            <BookmarkPlus />
          </Button>
        )}
        <div
          className={cn(
            'max-w-[70%] rounded-lg px-3 py-2 text-xs',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isAssistant
                ? 'bg-muted text-foreground'
                : 'bg-secondary text-secondary-foreground',
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
          ) : (
            <>
              <MarkdownMessage content={message.content} />
              {todo_items.length > 0 ? <TodoMessage items={todo_items} /> : null}
            </>
          )}
        </div>
        {isUser && canSaveMemory && (
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="shrink-0"
            title="메모리 저장"
            aria-label="메모리 저장"
            onClick={() => createPinnedMemoryMutation.mutate({ content: message.content })}
            disabled={createPinnedMemoryMutation.isPending}
          >
            <BookmarkPlus />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">{agent ? agent.name : '에이전트 대화'}</h1>
          {agent && (
            <p className="text-xs text-muted-foreground">
              타입: {agent.roleType === 'MAIN' ? '메인 에이전트' : '서브 에이전트'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.navigate({ to: '/agents' })}
        >
          목록으로
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="py-3">
          <p className="text-xs text-muted-foreground">
            선택한 에이전트와 개별적으로 대화할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-auto rounded-md border bg-background p-3 max-h-[min(1000px,calc(100dvh-320px))]"
            onScroll={handleScroll}
          >
            {isPending ? (
              <p className="text-xs text-muted-foreground">대화 내역을 불러오는 중입니다...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 대화가 없습니다. 아래 입력창에 질문이나 요청을 입력해 보세요.
              </p>
            ) : (
              messages.map(renderMessage)
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

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => chatImageInputRef.current?.click()}
                disabled={isUploadingChatImages}
              >
                이미지 업로드
              </Button>
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
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈, Enter 전송)"
            />
            <div className="flex items-center justify-between gap-2">
              <Select value={chatMode} onValueChange={(v) => setChatMode(v as 'CHAT' | 'TODO')}>
                <SelectTrigger size="sm" className="min-w-24">
                  <SelectValue placeholder="모드" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAT">대화</SelectItem>
                  <SelectItem value="TODO">투두</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMutation.isPending || isUploadingChatImages}
              >
                보내기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
