import { get_user_setting, update_user_setting } from '@/services/user-setting-service'
import type {
  UserSettingDataInterface,
  UserSettingUpdateBodyInterface,
} from '@/types/user-setting.type'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const user_setting_query_keys = {
  all: ['user_setting'] as const,
  detail: () => [...user_setting_query_keys.all, 'detail'] as const,
}

export const user_setting_query_options = queryOptions({
  queryKey: user_setting_query_keys.detail(),
  queryFn: get_user_setting,
})

export const useUserSetting = (
  options?: Omit<UseQueryOptions<UserSettingDataInterface, Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...user_setting_query_options,
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
    onSuccess: (data, variables, context, mutation) => {
      query_client.setQueryData(user_setting_query_keys.detail(), data)
      toast.success('설정이 저장되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? '설정을 저장하지 못했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}
