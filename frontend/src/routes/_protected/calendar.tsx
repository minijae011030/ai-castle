import { CalendarPage } from '@/pages/calendar/calendar-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/calendar')({
  component: CalendarPage,
})
