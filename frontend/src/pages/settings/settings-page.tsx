import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateUserSetting, useUserSetting } from '@/hooks/queries/user-setting-query'
import { useState } from 'react'

const SettingsPage = () => {
  const { data, isPending } = useUserSetting()
  const update_mutation = useUpdateUserSetting()

  const [is_editing, set_is_editing] = useState(false)
  const [user_name, set_user_name] = useState('')
  const [age, set_age] = useState('')
  const [interests, set_interests] = useState('')
  const [intensity, set_intensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [day_start_time, set_day_start_time] = useState('07:00')
  const [day_end_time, set_day_end_time] = useState('23:00')

  const handle_start_edit = () => {
    if (!data) return
    set_user_name(data.userName)
    set_day_start_time((data.dayStartTime ?? '').slice(0, 5) || '07:00')
    set_day_end_time((data.dayEndTime ?? '').slice(0, 5) || '23:00')
    set_age(data.age != null ? String(data.age) : '')
    set_interests(data.interests ?? '')
    set_intensity((data.intensity as 'low' | 'medium' | 'high') ?? 'medium')
    set_is_editing(true)
  }

  const handle_cancel = () => {
    set_is_editing(false)
  }

  const handle_submit = async () => {
    await update_mutation.mutateAsync({
      userName: user_name,
      dayStartTime: day_start_time,
      dayEndTime: day_end_time,
      age: age ? Number(age) : undefined,
      interests: interests || undefined,
      intensity,
    })
    set_is_editing(false)
  }

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">설정을 불러오는 중입니다...</p>
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">설정</h1>

      {!is_editing ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium">기본 정보</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">이름</span> {data.userName}
            </p>
            <p>
              <span className="text-muted-foreground">이메일</span> {data.email}
            </p>
            <p>
              <span className="text-muted-foreground">일과 시간</span>{' '}
              {(data.dayStartTime ?? '').slice(0, 5)} ~ {(data.dayEndTime ?? '').slice(0, 5)}
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={handle_start_edit}>
                수정
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-medium">기본 정보 수정</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="setting-name">이름</Label>
              <Input
                id="setting-name"
                value={user_name}
                onChange={(e) => set_user_name(e.target.value)}
                placeholder="이름을 입력하세요"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="setting-age">나이 (선택)</Label>
              <Input
                id="setting-age"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => set_age(e.target.value)}
                placeholder="예: 17"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="setting-interests">관심사 (선택)</Label>
              <Textarea
                id="setting-interests"
                value={interests}
                onChange={(e) => set_interests(e.target.value)}
                placeholder="예: 의대, 수학, 피아노..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>원하는 강도</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={intensity === 'low' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => set_intensity('low')}
                >
                  라이트
                </Button>
                <Button
                  type="button"
                  variant={intensity === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => set_intensity('medium')}
                >
                  보통
                </Button>
                <Button
                  type="button"
                  variant={intensity === 'high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => set_intensity('high')}
                >
                  하드
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>일과 시작/종료 시각</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={day_start_time}
                  onChange={(e) => set_day_start_time(e.target.value)}
                />
                <span className="self-center text-muted-foreground text-sm">~</span>
                <Input
                  type="time"
                  value={day_end_time}
                  onChange={(e) => set_day_end_time(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handle_cancel}>
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handle_submit}
                disabled={!user_name.trim() || update_mutation.isPending}
              >
                저장
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { SettingsPage }
