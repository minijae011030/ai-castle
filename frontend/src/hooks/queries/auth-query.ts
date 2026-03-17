import { login, signUp } from '@/services/auth-service'
import type {
  LoginRequestInterface,
  LoginResponseDataInterface,
  SignUpRequestInterface,
  SignUpResponseDataInterface,
} from '@/types/auth.type'
import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

/** Query Key Factory (규칙 8.2). 추후 유저 정보 쿼리 시 invalidation용 */
export const auth_query_keys = {
  all: ['auth'] as const,
}

/** 로그인 뮤테이션. onError 시 toast (규칙 11.2) */
export const useLogin = (
  options?: UseMutationOptions<LoginResponseDataInterface, Error, LoginRequestInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: (body: LoginRequestInterface) => login(body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: auth_query_keys.all })
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '로그인에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}

/** 회원가입 뮤테이션. onError 시 toast (규칙 11.2) */
export const useSignUp = (
  options?: UseMutationOptions<SignUpResponseDataInterface, Error, SignUpRequestInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: (body: SignUpRequestInterface) => signUp(body),
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: auth_query_keys.all })
    },
    onError: (error, variables, context, mutation) => {
      toast.error(error.message ?? '회원가입에 실패했습니다.')
      options?.onError?.(error, variables, context, mutation)
    },
    ...options,
  })
}
