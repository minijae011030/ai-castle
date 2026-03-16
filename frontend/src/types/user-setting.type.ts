export interface UserSettingDataInterface {
  email: string
  userName: string
  dayStartTime: string
  dayEndTime: string
  age: number | null
  interests: string | null
  intensity: 'low' | 'medium' | 'high' | null
}

export interface UserSettingResponseInterface {
  status: number
  message: string
  data: UserSettingDataInterface | null
}

export interface UserSettingUpdateBodyInterface {
  userName?: string
  dayStartTime?: string
  dayEndTime?: string
  age?: number
  interests?: string
  intensity?: 'low' | 'medium' | 'high'
}
