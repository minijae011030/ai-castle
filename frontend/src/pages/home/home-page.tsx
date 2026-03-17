import { useHealth } from '@/hooks/queries/health-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearAuth } from '@/services/auth-service'
import { useUserStore } from '@/stores/user.store'
import { useNavigate } from '@tanstack/react-router'

const HomePage = () => {
  const navigate = useNavigate()
  const healthQuery = useHealth()
  const userInfo = useUserStore((s) => s.userInfo)

  const handleLogout = () => {
    clearAuth()
    navigate({ to: '/login' })
  }

  const handleHealthCheck = () => {
    healthQuery.refetch()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">AI Castle</h1>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>
      {userInfo && (
        <p className="text-sm text-muted-foreground">
          {userInfo.user_name} ({userInfo.email})
        </p>
      )}
      <Button
        onClick={handleHealthCheck}
        disabled={healthQuery.isFetching}
        className={cn(healthQuery.isFetching && 'opacity-70')}
      >
        {healthQuery.isFetching ? '확인 중...' : '백엔드 헬스 체크'}
      </Button>
      {healthQuery.data && (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="font-medium">연결됨</p>
          {healthQuery.data.data && (
            <p className="text-muted-foreground">
              status: {healthQuery.data.data?.status ?? 'UNKNOWN'} / {healthQuery.data.message}
            </p>
          )}
        </div>
      )}
      {healthQuery.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">연결 실패</p>
          <p>{healthQuery.error.message}</p>
        </div>
      )}
    </div>
  )
}

export { HomePage }
