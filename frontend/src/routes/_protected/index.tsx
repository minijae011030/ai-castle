import { HomePage } from '@/pages/home/home-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/')({
  component: HomePage,
})
