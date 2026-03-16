import { SettingsPage } from '@/pages/settings/settings-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/settings')({
  component: SettingsPage,
})
