import { BadRequestException } from '@nestjs/common'
import { ApiException, FieldError } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import {
  resolveValidationTranslation,
  extractValidationContext,
} from '../translations/validation-translations'

const CONSTRAINT_CODE_MAP: Record<string, string> = {
  isEmail: 'VALIDATION.IS_EMAIL',
  isNotEmpty: 'VALIDATION.REQUIRED',
  isUuid: 'VALIDATION.INVALID_UUID',
  isValidBirthDate: 'VALIDATION.INVALID_BIRTH_DATE',
  isString: 'VALIDATION.INVALID',
  isNumber: 'VALIDATION.INVALID_NUMBER',
  isBoolean: 'VALIDATION.INVALID_BOOLEAN',
  isEnum: 'VALIDATION.INVALID_ENUM',
  isPhoneNumber: 'VALIDATION.INVALID_PHONE',
  min: 'VALIDATION.MIN',
  max: 'VALIDATION.MAX',
  minLength: 'VALIDATION.MIN_LENGTH',
  maxLength: 'VALIDATION.MAX_LENGTH',
  matches: 'VALIDATION.PATTERN',
  arrayMinSize: 'VALIDATION.ARRAY_MIN_SIZE',
  arrayMaxSize: 'VALIDATION.ARRAY_MAX_SIZE',
}

export class ValidationErrorMapper {
  static map(exception: BadRequestException): ApiException {
    const response = exception.getResponse()

    if (typeof response === 'string') {
      return ApiException.validation([{
        field: '',
        code: ApiErrorCodes.VALIDATION_FAILED,
        message: resolveValidationTranslation('isNotEmpty'),
      }])
    }

    const responseObj = response as Record<string, unknown>
    const flatErrors = responseObj as Record<string, string>

    if (typeof flatErrors === 'object' && flatErrors !== null && !Array.isArray(flatErrors)) {
      const fieldErrors: FieldError[] = Object.entries(flatErrors).map(([field, message]) => ({
        field,
        code: ValidationErrorMapper.inferCodeFromMessage(message),
        message: resolveValidationTranslation(ValidationErrorMapper.inferConstraintName(message)),
      }))

      return ApiException.validation(fieldErrors)
    }

    return ApiException.validation([{
      field: '',
      code: ApiErrorCodes.VALIDATION_FAILED,
      message: resolveValidationTranslation('isNotEmpty'),
    }])
  }

  static fromValidationErrors(errors: any[]): ApiException {
    const fieldErrors: FieldError[] = []

    const flatten = (errs: any[], parentPath = '') => {
      for (const err of errs) {
        const path = parentPath ? `${parentPath}.${err.property}` : err.property

        if (err.constraints) {
          for (const [constraintName, message] of Object.entries(err.constraints)) {
            const code = CONSTRAINT_CODE_MAP[constraintName] ?? `VALIDATION.${constraintName.toUpperCase()}`
            fieldErrors.push({
              field: path,
              code,
              message: resolveValidationTranslation(constraintName),
              context: extractValidationContext(constraintName, err.constraints[constraintName] ? [err.constraints[constraintName]] : []),
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

  private static inferConstraintName(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('email')) return 'isEmail'
    if (lower.includes('uuid')) return 'isUuid'
    if (lower.includes('required') || lower.includes('not empty')) return 'isNotEmpty'
    if (lower.includes('birth')) return 'isValidBirthDate'
    if (lower.includes('number')) return 'isNumber'
    if (lower.includes('enum') || lower.includes('invalid value')) return 'isEnum'
    return 'isNotEmpty'
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
