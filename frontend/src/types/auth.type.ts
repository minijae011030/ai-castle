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

/** 회원가입 요청 body */
export interface SignUpRequestInterface {
  email: string
  password: string
  user_name: string
}

/** 회원가입 성공 시 응답 data */
export interface SignUpResponseDataInterface {
  user_id: number
  email: string
  user_name: string
}

/** ResultResponse<SignUpResponseData> 형태 */
export interface AuthSignUpResponseInterface {
  status: number
  message: string
  data: SignUpResponseDataInterface | null
}
