import { requireGuest } from '@/lib/route-auth'
import { SignUpPage } from '@/pages/signup/signup-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signup')({
  beforeLoad: requireGuest,
  component: SignUpPage,
})
