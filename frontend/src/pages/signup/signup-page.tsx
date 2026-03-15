import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/services/auth-service'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

function SignUpPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user_name, setUserName] = useState('')
  const [signup_error, setSignupError] = useState<string | null>(null)
  const [is_loading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError(null)
    setIsLoading(true)
    try {
      await signUp({ email, password, user_name })
      navigate({ to: '/login' })
    } catch (e) {
      setSignupError(e instanceof Error ? e.message : '회원가입에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
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
            <Label htmlFor="signup-password">비밀번호 (8자 이상)</Label>
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
              value={user_name}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동"
              required
              autoComplete="name"
              className="h-10"
            />
          </div>
          {signup_error && (
            <p className="text-sm text-destructive" role="alert">
              {signup_error}
            </p>
          )}
          <Button type="submit" disabled={is_loading} className="mt-2 h-10">
            {is_loading ? '가입 중...' : '회원가입'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}

export { SignUpPage }
