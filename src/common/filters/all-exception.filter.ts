import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { QueryFailedError } from 'typeorm'
import { ApiException, FieldError } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { ApiErrorResponse } from '../interfaces/api-response.interface'
import { DatabaseErrorMapper } from '../mappers/database-error.mapper'
import { ValidationErrorMapper } from '../mappers/validation-error.mapper'
import { resolveTranslation } from '../translations/error-translations'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const apiException = this.normalizeException(exception)
    const responseObj = apiException.getResponse() as {
      code: ApiErrorCodes
      message: string
      details?: Record<string, unknown>
      fieldErrors?: FieldError[]
    }
    const status = apiException.getStatus()

    this.logException(request, status, responseObj.code, exception)

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: responseObj.code,
        message: responseObj.message,
        details: responseObj.details,
        fieldErrors: responseObj.fieldErrors,
      },
      requestId: (request as any).requestId ?? '',
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    }

    response.status(status).json(errorResponse)
  }

  private normalizeException(exception: unknown): ApiException {
    if (exception instanceof QueryFailedError) {
      return DatabaseErrorMapper.map(exception)
    }

    if (exception instanceof BadRequestException) {
      return ValidationErrorMapper.map(exception)
    }

    if (exception instanceof ApiException) {
      return exception
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception)
    }

    return ApiException.internal(
      this.isDev() && exception instanceof Error ? { message: exception.message, stack: exception.stack } : undefined,
    )
  }

  private fromHttpException(exception: HttpException): ApiException {
    const status = exception.getStatus()
    const code = this.mapStatusToCode(status)

    return new ApiException(status, code, resolveTranslation(code))
  }

  private mapStatusToCode(status: HttpStatus): ApiErrorCodes {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCodes.VALIDATION_FAILED
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCodes.AUTH_UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ApiErrorCodes.AUTH_FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ApiErrorCodes.USER_NOT_FOUND
      case HttpStatus.CONFLICT:
        return ApiErrorCodes.USER_ALREADY_EXISTS
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCodes.RATE_LIMIT_EXCEEDED
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ApiErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE
      default:
        return ApiErrorCodes.INTERNAL_SERVER_ERROR
    }
  }

  private logException(
    request: Request,
    status: HttpStatus,
    code: ApiErrorCodes,
    original: unknown,
  ): void {
    const requestId = (request as any).requestId ?? ''
    const userId = (request as any).user?.userId ?? ''
    const line = `[${requestId}] ${request.method} ${request.originalUrl} -> ${status}: ${code}${userId ? ` (user=${userId})` : ''}`

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(line, original instanceof Error ? original.stack : undefined)
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(line)
    }
  }

  private isDev(): boolean {
    return process.env.NODE_ENV !== 'production'
  }
}
