import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getHealth } from '@/services/health-service'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

const HomePage = () => {
  const [health_result, setHealthResult] = useState<{
    status: string
    message: string
  } | null>(null)
  const [health_error, setHealthError] = useState<string | null>(null)
  const [is_loading, setIsLoading] = useState(false)

  const handleHealthCheck = async () => {
    setHealthError(null)
    setHealthResult(null)
    setIsLoading(true)
    try {
      const res = await getHealth()
      setHealthResult({
        status: res.data?.status ?? 'UNKNOWN',
        message: res.message,
      })
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : '연결 실패')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold text-foreground">AI Castle</h1>
      <Link to="/login" className="text-sm text-primary hover:underline">
        로그인
      </Link>
      <Button
        onClick={handleHealthCheck}
        disabled={is_loading}
        className={cn(is_loading && 'opacity-70')}
      >
        {is_loading ? '확인 중...' : '백엔드 헬스 체크'}
      </Button>
      {health_result && (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="font-medium">연결됨</p>
          <p className="text-muted-foreground">
            status: {health_result.status} / {health_result.message}
          </p>
        </div>
      )}
      {health_error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">연결 실패</p>
          <p>{health_error}</p>
        </div>
      )}
    </div>
  )
}

export { HomePage }
