import { clearAuth } from '@/services/auth-service'
import { useUserStore } from '@/stores/user.store'
import axios, { type AxiosError, type AxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type Primitive = string | number | boolean | null | undefined

export type RequestOptions<TBody> = {
  params?: Record<string, Primitive>
  body?: TBody
  headers?: RawAxiosRequestHeaders
}

const baseURL = import.meta.env.VITE_PUBLIC_API as string | undefined

if (!baseURL) throw new Error('VITE_PUBLIC_API is missing')

const instance = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

instance.interceptors.request.use((config) => {
  const token = useUserStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let is_refreshing = false
let pending_requests: Array<() => void> = []

instance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status
    const original_request = error.config as AxiosRequestConfig & { _retry?: boolean }

    // accessToken 만료 등으로 인한 401 처리
    if (status === 401 && !original_request._retry) {
      original_request._retry = true

      // 동시에 여러 요청이 401이 나는 경우, 리프레시 결과를 공유
      if (is_refreshing) {
        await new Promise<void>((resolve) => {
          pending_requests.push(resolve)
        })
        // 리프레시 후 토큰이 갱신되었으므로, 원 요청 재시도
        return instance.request(error.config!)
      }

      is_refreshing = true
      try {
        // refresh 토큰으로 accessToken 재발급 시도
        type RefreshResponse = {
          status: number
          message: string
          data: { accessToken: string } | null
        }

        const refresh_res = await instance.post<RefreshResponse>('/api/auth/refresh')

        if (refresh_res.data.status !== 200 || !refresh_res.data.data?.accessToken) {
          throw new Error(refresh_res.data.message ?? '토큰 재발급에 실패했습니다.')
        }

        const new_access_token = refresh_res.data.data.accessToken
        useUserStore.getState().setAccessToken(new_access_token)

        // 대기 중이던 요청들 깨우기
        pending_requests.forEach((resolve) => resolve())
        pending_requests = []

        // 원래 요청 재시도
        return instance.request(error.config!)
      } catch (refresh_error) {
        // 리프레시 실패 시 전역 로그아웃
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(refresh_error)
      } finally {
        is_refreshing = false
      }
    }

    if (error.response?.data && (error.response.data as Error).message) {
      return Promise.reject(new Error((error.response.data as Error).message))
    }

    return Promise.reject(error)
  },
)

export class API {
  private static async request<TResponse, TBody = unknown>(
    method: HttpMethod,
    url: string,
    options: RequestOptions<TBody> = {},
  ): Promise<TResponse> {
    const config: AxiosRequestConfig = {
      method,
      url,
      params: options.params,
      headers: {
        ...(options.headers ?? {}),
      },
      data: options.body,
    }

    const res = await instance.request<TResponse>(config)
    return res.data
  }

  static get<TResponse>(url: string, options?: RequestOptions<never>) {
    return API.request<TResponse>('GET', url, options ?? {})
  }

  static post<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>('POST', url, { ...options, body })
  }

  static postForm<TResponse>(url: string, formData: FormData) {
    return API.request<TResponse, FormData>('POST', url, {
      body: formData,
      headers: {
        'Content-Type': undefined as unknown as string,
      },
    })
  }

  static put<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>('PUT', url, { ...options, body })
  }

  static patch<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>('PATCH', url, { ...options, body })
  }

  static delete<TResponse>(url: string, options?: RequestOptions<never>) {
    return API.request<TResponse>('DELETE', url, options)
  }
}
