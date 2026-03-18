declare module 'react-syntax-highlighter' {
  import * as React from 'react'

  export type SyntaxHighlighterProps = {
    language?: string
    style?: Record<string, React.CSSProperties>
    PreTag?: React.ElementType
    customStyle?: React.CSSProperties
    codeTagProps?: React.HTMLAttributes<HTMLElement>
    children?: React.ReactNode
  } & React.HTMLAttributes<HTMLElement>

  export const Prism: React.ComponentType<SyntaxHighlighterProps>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, import('react').CSSProperties>
}
