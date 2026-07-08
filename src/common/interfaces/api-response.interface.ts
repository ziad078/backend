import { ApiErrorCodes } from '../enums/api-error.enum'

export interface FieldError {
  field: string
  code: string
  message: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ResponseMeta {
  pagination?: PaginationMeta
  [key: string]: unknown
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: ResponseMeta
  requestId: string
  timestamp: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ApiErrorCodes
    message: string
    details?: Record<string, unknown>
    fieldErrors?: FieldError[]
  }
  requestId: string
  timestamp: string
  path: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
