import { SignUpPage } from '@/pages/signup/signup-page'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useUserStore } from '@/stores/user.store'

export const Route = createFileRoute('/signup')({
  beforeLoad: () => {
    const token = useUserStore.getState().accessToken
    if (token) {
      throw redirect({ to: '/' })
    }
  },
  component: SignUpPage,
})
