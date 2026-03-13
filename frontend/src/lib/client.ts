import axios, {
  type AxiosRequestConfig,
  type RawAxiosRequestHeaders,
} from "axios";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Primitive = string | number | boolean | null | undefined;

export type RequestOptions<TBody> = {
  params?: Record<string, Primitive>;
  body?: TBody;
  headers?: RawAxiosRequestHeaders;
};

const baseURL2 = import.meta.env.VITE_PUBLIC_API2 as string | undefined;
const blogId = import.meta.env.VITE_PUBLIC_BLOG_ID as string | undefined;

if (!baseURL2) throw new Error("VITE_PUBLIC_API is missing");
if (!blogId) throw new Error("VITE_PUBLIC_BLOG_ID is missing");

const instance = axios.create({
  baseURL: baseURL2,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    blogId,
  },
});

instance.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.data) {
      return Promise.reject(new Error(error.response.data.message));
    }

    return Promise.reject(error);
  },
);

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
    };

    const res = await instance.request<TResponse>(config);
    return res.data;
  }

  static get<TResponse>(url: string, options?: RequestOptions<never>) {
    return API.request<TResponse>("GET", url, options ?? {});
  }

  static post<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>("POST", url, { ...options, body });
  }

  // multipart/form-data 전용 (파일 업로드)
  static postForm<TResponse>(url: string, formData: FormData) {
    return API.request<TResponse, FormData>("POST", url, {
      body: formData,
      headers: {
        // axios가 boundary를 자동 설정하게 두는게 핵심
        "Content-Type": undefined as unknown as string,
      },
    });
  }

  static put<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>("PUT", url, { ...options, body });
  }

  static patch<TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions<TBody>,
  ) {
    return API.request<TResponse, TBody>("PATCH", url, { ...options, body });
  }

  static delete<TResponse>(url: string, options?: RequestOptions<never>) {
    return API.request<TResponse>("DELETE", url, options);
  }
}
