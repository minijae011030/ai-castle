import { CalendarPlaceholderPage } from '@/pages/calendar/calendar-placeholder-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/calendar')({
  component: CalendarPlaceholderPage,
})
