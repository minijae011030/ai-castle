import { TestPage } from '@/pages/test/test-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test')({
  component: TestPage,
})
