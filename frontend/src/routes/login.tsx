import { requireGuest } from '@/lib/route-auth'
import { LoginPage } from '@/pages/login/login-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  beforeLoad: requireGuest,
  component: LoginPage,
})
