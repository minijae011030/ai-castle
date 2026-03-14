import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { login } from '@/services/auth-service'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

const LoginPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login_error, setLoginError] = useState<string | null>(null)
  const [is_loading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setIsLoading(true)
    try {
      await login({ email, password })
      navigate({ to: '/' })
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : '로그인에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-card-foreground">
          AI Castle 로그인
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={cn(
                'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className={cn(
                'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              )}
            />
          </div>
          {login_error && <p className="text-sm text-destructive">{login_error}</p>}
          <Button type="submit" disabled={is_loading} className="mt-2">
            {is_loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export { LoginPage }
