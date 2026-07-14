import { HttpException, HttpStatus } from '@nestjs/common'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { resolveTranslation } from '../translations/error-translations'

export interface FieldError {
  field: string
  code: string
  message: string
  context?: Record<string, unknown>
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

  static badRequest(code: ApiErrorCodes, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, code, resolveTranslation(code), details)
  }

  static unauthorized(code: ApiErrorCodes = ApiErrorCodes.AUTH_UNAUTHORIZED): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, code, resolveTranslation(code))
  }

  static forbidden(code: ApiErrorCodes = ApiErrorCodes.AUTH_FORBIDDEN, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, code, resolveTranslation(code), details)
  }

  static notFound(code: ApiErrorCodes, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, code, resolveTranslation(code), details)
  }

  static conflict(code: ApiErrorCodes, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.CONFLICT, code, resolveTranslation(code), details)
  }

  static tooManyRequests(retryAfter?: number): ApiException {
    return new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      ApiErrorCodes.RATE_LIMIT_EXCEEDED,
      resolveTranslation(ApiErrorCodes.RATE_LIMIT_EXCEEDED),
      retryAfter ? { retryAfter } : undefined,
    )
  }

  static internal(details?: Record<string, unknown>): ApiException {
    return new ApiException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ApiErrorCodes.INTERNAL_SERVER_ERROR,
      resolveTranslation(ApiErrorCodes.INTERNAL_SERVER_ERROR),
      details,
    )
  }

  static validation(fieldErrors: FieldError[]): ApiException {
    return new ApiException(
      HttpStatus.BAD_REQUEST,
      ApiErrorCodes.VALIDATION_FAILED,
      resolveTranslation(ApiErrorCodes.VALIDATION_FAILED),
      undefined,
      fieldErrors,
    )
  }

  static serviceUnavailable(code: ApiErrorCodes, details?: Record<string, unknown>): ApiException {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, resolveTranslation(code), details)
  }
}
