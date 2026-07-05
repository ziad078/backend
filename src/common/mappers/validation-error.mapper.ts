import { BadRequestException, HttpStatus } from '@nestjs/common'
import { ApiException } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'

export class ValidationErrorMapper {
  static map(exception: BadRequestException): ApiException {
    const response = exception.getResponse()
    if (typeof response === 'string') {
      return new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCodes.VALIDATION_ERROR, response)
    }
    return new ApiException(
      HttpStatus.BAD_REQUEST,
      ApiErrorCodes.VALIDATION_ERROR,
      'validation error',
      { ...response },
    )
  }
}
