// mappers/database-error.mapper.ts
import { HttpStatus } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { ApiException } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { PgErrorCode } from '../enums/database-error.enum'

export const DATABASE_CONSTRAINTS: Record<
  string,
  {
    code: ApiErrorCodes
    message: string
  }
> = {
  // ================= Users =================

  users_email_unique: {
    code: ApiErrorCodes.EMAIL_ALREADY_EXISTS,
    message: 'Email already exists',
  },

  users_phone_unique: {
    code: ApiErrorCodes.PHONE_ALREADY_EXISTS,
    message: 'Phone number already exists',
  },

  // ================= Organizations =================

  organizations_slug_unique: {
    code: ApiErrorCodes.ORGANIZATION_ALREADY_EXISTS,
    message: 'Organization already exists',
  },

  // ================= Grades =================

  grades_name_organization_unique: {
    code: ApiErrorCodes.GRADE_ALREADY_EXISTS,
    message: 'Grade already exists',
  },

  // ================= Classes =================

  classes_name_grade_unique: {
    code: ApiErrorCodes.CLASS_ALREADY_EXISTS,
    message: 'Class already exists',
  },

  // ================= Subjects =================

  subjects_name_organization_unique: {
    code: ApiErrorCodes.SUBJECT_ALREADY_EXISTS,
    message: 'Subject already exists',
  },
} satisfies Record<
  string,
  {
    code: ApiErrorCodes
    message: string
  }
>

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
          ApiErrorCodes.CONFLICT,
          'This operation references a record that does not exist or is in use',
          {
            constraint: driverError.constraint,
            table: driverError.table,
          },
        )

      case PgErrorCode.NOT_NULL_VIOLATION:
        return new ApiException(
          HttpStatus.BAD_REQUEST,
          ApiErrorCodes.VALIDATION_ERROR,
          `Field "${driverError.column}" is required`,
          { column: driverError.column, table: driverError.table },
        )

      case PgErrorCode.CHECK_VIOLATION:
        return new ApiException(
          HttpStatus.BAD_REQUEST,
          ApiErrorCodes.VALIDATION_ERROR,
          'One or more fields violate database constraints',
          { constraint: driverError.constraint, table: driverError.table },
        )

      default:
        return new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          ApiErrorCodes.INTERNAL_SERVER_ERROR,
          'Database error occurred',
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
      config?.code ?? ApiErrorCodes.CONFLICT,
      config?.message ?? 'A record with this value already exists',
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
