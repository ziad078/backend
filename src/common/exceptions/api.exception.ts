import { HttpException, HttpStatus } from '@nestjs/common'
import { ApiErrorCodes } from '../enums/api-error.enum'

export interface FieldError {
  field: string
  code: string
  message: string
}

export class ApiException extends HttpException {
  public readonly code: ApiErrorCodes
  public readonly details?: Record<string, unknown>
  public readonly fieldErrors?: FieldError[]

  constructor(
    status: HttpStatus,
    code: ApiErrorCodes,
    message: string,
    details?: Record<string, unknown>,
    fieldErrors?: FieldError[],
  ) {
    super({ code, message, details, fieldErrors }, status)
    this.code = code
    this.details = details
    this.fieldErrors = fieldErrors
  }

  static badRequest(code: ApiErrorCodes, message: string, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message, details)
  }

  static unauthorized(code: ApiErrorCodes = ApiErrorCodes.AUTH_UNAUTHORIZED, message = 'Authentication required'): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, code, message)
  }

  static forbidden(code: ApiErrorCodes = ApiErrorCodes.AUTH_FORBIDDEN, message = 'Insufficient permissions', details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, code, message, details)
  }

  static notFound(code: ApiErrorCodes, message: string, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, code, message, details)
  }

  static conflict(code: ApiErrorCodes, message: string, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.CONFLICT, code, message, details)
  }

  static tooManyRequests(retryAfter?: number): ApiException {
    return new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      ApiErrorCodes.RATE_LIMIT_EXCEEDED,
      'Too many requests',
      retryAfter ? { retryAfter } : undefined,
    )
  }

  static internal(message = 'An unexpected error occurred', details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCodes.INTERNAL_SERVER_ERROR, message, details)
  }

  static validation(fieldErrors: FieldError[]): ApiException {
    return new ApiException(
      HttpStatus.BAD_REQUEST,
      ApiErrorCodes.VALIDATION_FAILED,
      'Validation failed',
      undefined,
      fieldErrors,
    )
  }

  static serviceUnavailable(code: ApiErrorCodes, message: string, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, message, details)
  }
}
