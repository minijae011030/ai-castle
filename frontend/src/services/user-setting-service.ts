import { API } from '@/lib/client'
import type {
  UserSettingDataInterface,
  UserSettingResponseInterface,
  UserSettingUpdateBodyInterface,
} from '@/types/user-setting.type'

export async function get_user_setting(): Promise<UserSettingDataInterface> {
  const res = await API.get<UserSettingResponseInterface>('/api/user/settings')

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '사용자 설정을 불러오지 못했습니다.')
  }

  return res.data
}

export async function update_user_setting(
  body: UserSettingUpdateBodyInterface,
): Promise<UserSettingDataInterface> {
  const res = await API.patch<UserSettingResponseInterface, UserSettingUpdateBodyInterface>(
    '/api/user/settings',
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? '사용자 설정을 저장하지 못했습니다.')
  }

  return res.data
}
