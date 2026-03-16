import { get_user_setting, update_user_setting } from '@/services/user-setting-service'
import type {
  UserSettingDataInterface,
  UserSettingUpdateBodyInterface,
} from '@/types/user-setting.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export const user_setting_query_keys = {
  all: ['user_setting'] as const,
  detail: () => [...user_setting_query_keys.all, 'detail'] as const,
}

export const useUserSetting = (options?: UseQueryOptions<UserSettingDataInterface, Error>) => {
  return useQuery({
    queryKey: user_setting_query_keys.detail(),
    queryFn: async () => {
      const res = await get_user_setting()
      return res
    },
    select: useCallback((data: UserSettingDataInterface) => data, []),
    ...options,
  })
}

export const useUpdateUserSetting = (
  options?: UseMutationOptions<UserSettingDataInterface, Error, UserSettingUpdateBodyInterface>,
) => {
  const query_client = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: update_user_setting,
    onSuccess: (data) => {
      query_client.setQueryData(user_setting_query_keys.detail(), data)
      toast.success('설정이 저장되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '설정을 저장하지 못했습니다.')
    },
  })
}
