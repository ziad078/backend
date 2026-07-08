import { BadRequestException, HttpStatus } from '@nestjs/common'
import { ApiException, FieldError } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'

const CONSTRAINT_CODE_MAP: Record<string, string> = {
  isEmail: 'VALIDATION.IS_EMAIL',
  isNotEmpty: 'VALIDATION.REQUIRED',
  isUuid: 'VALIDATION.INVALID_UUID',
  isValidBirthDate: 'VALIDATION.INVALID_BIRTH_DATE',
  isString: 'VALIDATION.REQUIRED',
  isNumber: 'VALIDATION.INVALID_NUMBER',
  min: 'VALIDATION.MIN',
  max: 'VALIDATION.MAX',
  minLength: 'VALIDATION.MIN_LENGTH',
  maxLength: 'VALIDATION.MAX_LENGTH',
  isBoolean: 'VALIDATION.INVALID_BOOLEAN',
  isEnum: 'VALIDATION.INVALID_ENUM',
  isPhoneNumber: 'VALIDATION.INVALID_PHONE',
  matches: 'VALIDATION.INVALID_FORMAT',
}

export class ValidationErrorMapper {
  static map(exception: BadRequestException): ApiException {
    const response = exception.getResponse()

    if (typeof response === 'string') {
      return ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED, response)
    }

    const responseObj = response as Record<string, unknown>
    const flatErrors = responseObj as Record<string, string>

    if (typeof flatErrors === 'object' && flatErrors !== null && !Array.isArray(flatErrors)) {
      const fieldErrors: FieldError[] = Object.entries(flatErrors).map(([field, message]) => ({
        field,
        code: ValidationErrorMapper.inferCodeFromMessage(message),
        message: String(message),
      }))

      return ApiException.validation(fieldErrors)
    }

    return ApiException.badRequest(
      ApiErrorCodes.VALIDATION_FAILED,
      'Validation failed',
      { ...responseObj },
    )
  }

  static fromValidationErrors(errors: any[]): ApiException {
    const fieldErrors: FieldError[] = []

    const flatten = (errs: any[], parentPath = '') => {
      for (const err of errs) {
        const path = parentPath ? `${parentPath}.${err.property}` : err.property

        if (err.constraints) {
          for (const [constraintName, message] of Object.entries(err.constraints)) {
            fieldErrors.push({
              field: path,
              code: CONSTRAINT_CODE_MAP[constraintName] ?? `VALIDATION.${constraintName.toUpperCase()}`,
              message: String(message),
            })
          }
        }

        if (err.children?.length > 0) {
          flatten(err.children, path)
        }
      }
    }

    flatten(errors)
    return ApiException.validation(fieldErrors)
  }

  private static inferCodeFromMessage(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('email')) return 'VALIDATION.IS_EMAIL'
    if (lower.includes('uuid')) return 'VALIDATION.INVALID_UUID'
    if (lower.includes('required') || lower.includes('not empty')) return 'VALIDATION.REQUIRED'
    if (lower.includes('birth')) return 'VALIDATION.INVALID_BIRTH_DATE'
    if (lower.includes('number')) return 'VALIDATION.INVALID_NUMBER'
    if (lower.includes('enum') || lower.includes('invalid value')) return 'VALIDATION.INVALID_ENUM'
    return 'VALIDATION.FAILED'
  }
}
