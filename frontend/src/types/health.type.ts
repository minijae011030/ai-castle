/** 백엔드 health API 응답 data.payload */
export interface HealthPayloadInterface {
  status: string
}

/** ResultResponse<HealthPayload> 형태 */
export interface HealthResponseInterface {
  status: number
  message: string
  data: HealthPayloadInterface | null
}
