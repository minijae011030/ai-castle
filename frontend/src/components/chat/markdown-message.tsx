import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface MarkdownMessageProps {
  content: string
  className?: string
}

export const MarkdownMessage = ({ content, className }: MarkdownMessageProps) => {
  const normalizedContent = content.replace(/\n{3,}/g, '\n\n').trim()
  const syntaxStyle = Object.fromEntries(
    Object.entries(oneDark as Record<string, Record<string, unknown>>).map(([key, value]) => {
      return [
        key,
        {
          ...value,
          // 테마 기본 textShadow 때문에 글자가 “그림자/번짐”처럼 보이는 경우가 있어 강제로 제거
          textShadow: 'none',
        },
      ]
    }),
  ) as unknown as Record<string, React.CSSProperties>

  return (
    <div
      className={cn(
        // markdown은 기본적으로 개행/공백을 처리하므로 pre-wrap을 쓰면 빈 줄이 과하게 커져 보일 수 있음
        'whitespace-normal wrap-break-word text-sm leading-[1.35rem]',
        // basic markdown styling (tailwind-typography 없이)
        // 기본 p margin 제거(리스트 내부 p 포함)
        '[&_p]:my-0',
        '[&_p+p]:mt-1',
        '[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4',
        '[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4',
        '[&_li]:my-0.5',
        '[&_ol>li]:pl-0 [&_ul>li]:pl-0',
        // 인라인 코드는 아래 components에서만 스타일 적용 (코드블럭에 전역 code 스타일이 섞이는 것 방지)
        // pre는 SyntaxHighlighter가 렌더링하므로 padding/background는 커스텀 컨테이너에서 처리
        '[&_pre]:my-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md',
        '[&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-black/20 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className: codeClassName, children, ...props }) => {
            const rawCode = String(children ?? '')
            const normalizedCode = rawCode.replace(/\n$/, '')
            const match = /language-([a-zA-Z0-9_-]+)/.exec(codeClassName ?? '')
            const language = match?.[1]

            // 인라인 코드(백틱 한 번)는 하이라이팅 없이 기존 스타일 유지
            if (!language) {
              return (
                <code
                  className={cn(
                    'rounded bg-black/10 px-1 py-0.5',
                    'font-mono text-[0.95em] leading-[1.35rem]',
                    codeClassName,
                  )}
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <div className="my-1 overflow-hidden rounded-md border border-black/10 bg-[#282c34]">
                <div className="flex items-center justify-between bg-[#21252b] px-2 py-1 text-[10px] leading-none text-white/70">
                  <span className="font-medium uppercase tracking-wide">{language}</span>
                </div>
                <div className="p-2">
                  <SyntaxHighlighter
                    language={language}
                    style={syntaxStyle as never}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      background: 'transparent',
                      padding: 0,
                      fontSize: '12px',
                      lineHeight: '1.35rem',
                    }}
                    codeTagProps={{
                      style: {
                        textShadow: 'none',
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      },
                    }}
                  >
                    {normalizedCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            )
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
