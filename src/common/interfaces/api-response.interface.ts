import { ApiErrorCodes } from '../enums/api-error.enum'

export interface BaseApiResponse {
  success: boolean
  timestamp: string
}

export interface ApiSuccessResponse<T> extends BaseApiResponse {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorResponse extends BaseApiResponse {
  success: false

  error: {
    code: ApiErrorCodes
    message: string
    details?: Record<string, unknown>
  }

  path: string
}
