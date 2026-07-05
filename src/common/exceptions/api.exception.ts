import { HttpException, HttpStatus } from '@nestjs/common'
import { ApiErrorCodes } from '../enums/api-error.enum'

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ApiErrorCodes,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code,
        message,
        details,
      },
      status,
    )
  }
}
