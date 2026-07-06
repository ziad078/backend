// filters/all-exceptions.filter.ts
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
import { ApiException } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { ApiErrorResponse } from '../interfaces/api-response.interface'
import { DatabaseErrorMapper } from '../mappers/database-error.mapper'
import { ValidationErrorMapper } from '../mappers/validation-error.mapper'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const apiException = this.normalizeException(exception)
    const { code, message, details } = apiException.getResponse() as {
      code: ApiErrorCodes
      message: string
      details?: Record<string, unknown>
    }
    const status = apiException.getStatus()

    this.logException(request, status, message, exception)

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      error: { code, message, details },
    }

    response.status(status).json(errorResponse)
  }

  /**
   * يحول أي Exception كان (DB, Http, Api, أو Unknown) إلى ApiException موحد.
   */
  private normalizeException(exception: unknown): ApiException {
    // 1) أخطاء الداتابيز
    if (exception instanceof QueryFailedError) {
      return DatabaseErrorMapper.map(exception)
    }

    if (exception instanceof BadRequestException) {
      return ValidationErrorMapper.map(exception)
    }

    // 2) الاستثناء بتاعنا أصلاً — يمر زي ما هو
    if (exception instanceof ApiException) {
      return exception
    }

    // 3) أي HttpException عادي من Nest (ValidationPipe, NotFoundException...)
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception)
    }

    // 4) أي حاجة تانية غير متوقعة
    return new ApiException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ApiErrorCodes.INTERNAL_SERVER_ERROR,
      'Internal server error',
      this.isDev() && exception instanceof Error ? { stack: exception.stack } : undefined,
    )
  }

  private fromHttpException(exception: HttpException): ApiException {
    const status = exception.getStatus()
    const response = exception.getResponse()

    let message: string
    let details: Record<string, unknown> | undefined

    if (typeof response === 'string') {
      message = response
    } else {
      const responseObj = response as Record<string, unknown>
      if (Array.isArray(responseObj.message)) {
        message = 'Validation failed'
        details = { errors: responseObj.message }
      } else {
        message = (responseObj.message as string) ?? exception.message
      }
    }

    return new ApiException(status, this.mapStatusToCode(status), message, details)
  }

  private mapStatusToCode(status: HttpStatus): ApiErrorCodes {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCodes.VALIDATION_ERROR
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCodes.UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ApiErrorCodes.FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ApiErrorCodes.NOT_FOUND
      case HttpStatus.CONFLICT:
        return ApiErrorCodes.CONFLICT
      default:
        return ApiErrorCodes.INTERNAL_SERVER_ERROR
    }
  }

  private logException(
    request: Request,
    status: HttpStatus,
    message: string,
    original: unknown,
  ): void {
    const line = `${request.method} ${request.originalUrl} -> ${status}: ${message}`
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(line, original instanceof Error ? original.stack : undefined)
    } else {
      this.logger.warn(line)
    }
  }

  private isDev(): boolean {
    return process.env.NODE_ENV !== 'production'
  }
}
