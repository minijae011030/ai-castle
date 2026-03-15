import { useHealth } from '@/hooks/queries/health-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearAuth } from '@/services/auth-service'
import { useUserStore } from '@/stores/user.store'
import { useNavigate } from '@tanstack/react-router'

const HomePage = () => {
  const navigate = useNavigate()
  const health_query = useHealth()
  const user_info = useUserStore((s) => s.userInfo)

  const handleLogout = () => {
    clearAuth()
    navigate({ to: '/login' })
  }

  const handleHealthCheck = () => {
    health_query.refetch()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">AI Castle</h1>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>
      {user_info && (
        <p className="text-sm text-muted-foreground">
          {user_info.user_name} ({user_info.email})
        </p>
      )}
      <Button
        onClick={handleHealthCheck}
        disabled={health_query.isFetching}
        className={cn(health_query.isFetching && 'opacity-70')}
      >
        {health_query.isFetching ? '확인 중...' : '백엔드 헬스 체크'}
      </Button>
      {health_query.data && (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="font-medium">연결됨</p>
          <p className="text-muted-foreground">
            status: {health_query.data.data?.status ?? 'UNKNOWN'} / {health_query.data.message}
          </p>
        </div>
      )}
      {health_query.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">연결 실패</p>
          <p>{health_query.error.message}</p>
        </div>
      )}
    </div>
  )
}

export { HomePage }
