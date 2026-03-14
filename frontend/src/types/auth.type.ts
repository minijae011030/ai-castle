/** 로그인 요청 body */
export interface LoginRequestInterface {
  email: string
  password: string
}

/** 로그인 성공 시 응답 data (body에 accessToken, refreshToken은 쿠키) */
export interface LoginResponseDataInterface {
  accessToken: string
}

/** ResultResponse<LoginResponseData> 형태 */
export interface AuthLoginResponseInterface {
  status: number
  message: string
  data: LoginResponseDataInterface | null
}
