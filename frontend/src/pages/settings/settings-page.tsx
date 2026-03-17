import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateUserSetting, useUserSetting } from '@/hooks/queries/user-setting-query'
import { useState } from 'react'

const SettingsPage = () => {
  const { data, isPending } = useUserSetting()
  const updateUserSettingMutation = useUpdateUserSetting()

  const [isEditing, setIsEditing] = useState(false)
  const [userName, setUserName] = useState('')
  const [age, setAge] = useState('')
  const [interests, setInterests] = useState('')
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [dayStartTime, setDayStartTime] = useState('07:00')
  const [dayEndTime, setDayEndTime] = useState('23:00')

  const handle_start_edit = () => {
    if (!data) return
    setUserName(data.userName)
    setDayStartTime((data.dayStartTime ?? '').slice(0, 5) || '07:00')
    setDayEndTime((data.dayEndTime ?? '').slice(0, 5) || '23:00')
    setAge(data.age != null ? String(data.age) : '')
    setInterests(data.interests ?? '')
    setIntensity((data.intensity as 'low' | 'medium' | 'high') ?? 'medium')
    setIsEditing(true)
  }

  const handle_cancel = () => {
    setIsEditing(false)
  }

  const handle_submit = async () => {
    await updateUserSettingMutation.mutateAsync({
      userName: userName,
      dayStartTime: dayStartTime,
      dayEndTime: dayEndTime,
      age: age ? Number(age) : undefined,
      interests: interests || undefined,
      intensity,
    })
    setIsEditing(false)
  }

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">설정을 불러오는 중입니다...</p>
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">설정</h1>

      {!isEditing ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium">기본 정보</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">이름</span> {userName}
            </p>
            <p>
              <span className="text-muted-foreground">일과 시간</span> {dayStartTime} ~ {dayEndTime}
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
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
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
                onChange={(e) => setAge(e.target.value)}
                placeholder="예: 17"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="setting-interests">관심사 (선택)</Label>
              <Textarea
                id="setting-interests"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
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
                  onClick={() => setIntensity('low')}
                >
                  라이트
                </Button>
                <Button
                  type="button"
                  variant={intensity === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIntensity('medium')}
                >
                  보통
                </Button>
                <Button
                  type="button"
                  variant={intensity === 'high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIntensity('high')}
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
                  value={dayStartTime}
                  onChange={(e) => setDayStartTime(e.target.value)}
                />
                <span className="self-center text-muted-foreground text-sm">~</span>
                <Input
                  type="time"
                  value={dayEndTime}
                  onChange={(e) => setDayEndTime(e.target.value)}
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
                disabled={!userName.trim() || updateUserSettingMutation.isPending}
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
