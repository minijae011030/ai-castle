import { useSignUp } from '@/hooks/queries/auth-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const SignUpPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userName, setUserName] = useState('')
  const signUpMutation = useSignUp()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    signUpMutation.reset()
    await signUpMutation.mutateAsync({ email, password, user_name: userName })
    navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-card-foreground">회원가입</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email">이메일</Label>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">비밀번호</Label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-name">이름</Label>
            <Input
              id="signup-name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동"
              required
              autoComplete="name"
              className="h-10"
            />
          </div>
          <Button type="submit" disabled={signUpMutation.isPending} className="mt-2 h-10">
            {signUpMutation.isPending ? '가입 중...' : '회원가입'}
          </Button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="text-primary hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
