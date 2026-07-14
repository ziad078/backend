import { HttpStatus } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { ApiException } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { PgErrorCode } from '../enums/database-error.enum'
import { resolveTranslation } from '../translations/error-translations'

export const DATABASE_CONSTRAINTS: Record<string, { code: ApiErrorCodes; translationKey: string }> = {
  users_email_unique: { code: ApiErrorCodes.USER_EMAIL_IN_USE, translationKey: 'errors.user.emailInUse' },
  users_phone_unique: { code: ApiErrorCodes.USER_PHONE_IN_USE, translationKey: 'errors.user.phoneInUse' },
  organizations_slug_unique: { code: ApiErrorCodes.ORGANIZATION_ALREADY_EXISTS, translationKey: 'errors.organization.alreadyExists' },
  grades_name_organization_unique: { code: ApiErrorCodes.GRADE_ALREADY_EXISTS, translationKey: 'errors.grade.alreadyExists' },
  classes_name_grade_unique: { code: ApiErrorCodes.CLASS_ALREADY_EXISTS, translationKey: 'errors.class.alreadyExists' },
  subjects_name_organization_unique: { code: ApiErrorCodes.CLASS_ALREADY_EXISTS, translationKey: 'errors.class.alreadyExists' },
  evaluation_slot_organizationChildId_parentId_kind_key: { code: ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND, translationKey: 'errors.evaluation.slotNotFound' },
  evaluation_slot_privateChildId_parentId_kind_key: { code: ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND, translationKey: 'errors.evaluation.slotNotFound' },
}

export class DatabaseErrorMapper {
  static map(exception: QueryFailedError<any>): ApiException {
    const driverError = exception.driverError as {
      code: string
      detail?: string
      constraint?: string
      table?: string
      column?: string
      schema?: string
      hint?: string
    }

    switch (driverError.code as PgErrorCode) {
      case PgErrorCode.UNIQUE_VIOLATION:
        return DatabaseErrorMapper.handleUniqueViolation(driverError)

      case PgErrorCode.FOREIGN_KEY_VIOLATION:
        return new ApiException(
          HttpStatus.CONFLICT,
          ApiErrorCodes.DB_FOREIGN_KEY_VIOLATION,
          resolveTranslation(ApiErrorCodes.DB_FOREIGN_KEY_VIOLATION),
          {
            constraint: driverError.constraint,
            table: driverError.table,
          },
        )

      case PgErrorCode.NOT_NULL_VIOLATION:
        return new ApiException(
          HttpStatus.BAD_REQUEST,
          ApiErrorCodes.DB_NOT_NULL_VIOLATION,
          resolveTranslation(ApiErrorCodes.DB_NOT_NULL_VIOLATION),
          { column: driverError.column, table: driverError.table },
        )

      case PgErrorCode.CHECK_VIOLATION:
        return new ApiException(
          HttpStatus.BAD_REQUEST,
          ApiErrorCodes.DB_CHECK_VIOLATION,
          resolveTranslation(ApiErrorCodes.DB_CHECK_VIOLATION),
          { constraint: driverError.constraint, table: driverError.table },
        )

      default:
        return new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          ApiErrorCodes.DB_ERROR,
          resolveTranslation(ApiErrorCodes.DB_ERROR),
          this.isDev() ? { code: driverError.code, detail: driverError.detail } : undefined,
        )
    }
  }

  private static handleUniqueViolation(driverError: {
    code: string
    detail?: string
    constraint?: string
    table?: string
    column?: string
    schema?: string
    hint?: string
  }): ApiException {
    const constraint = driverError.constraint?.toLowerCase() ?? ''
    const config = DATABASE_CONSTRAINTS[constraint]

    return new ApiException(
      HttpStatus.CONFLICT,
      config?.code ?? ApiErrorCodes.DB_UNIQUE_VIOLATION,
      config?.translationKey ?? resolveTranslation(ApiErrorCodes.DB_UNIQUE_VIOLATION),
      {
        constraint: driverError.constraint,
        table: driverError.table,
      },
    )
  }

  private static isDev(): boolean {
    return process.env.NODE_ENV !== 'production'
  }
}
