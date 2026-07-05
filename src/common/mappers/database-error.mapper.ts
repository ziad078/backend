// mappers/database-error.mapper.ts
import { HttpStatus } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { ApiException } from '../exceptions/api.exception'
import { ApiErrorCodes } from '../enums/api-error.enum'
import { PgErrorCode } from '../enums/database-error.enum'

const DATABASE_CONSTRAINTS: Record<
  string,
  {
    code: ApiErrorCodes
    message: string
  }
> = {
  users_email_key: {
    code: ApiErrorCodes.EMAIL_ALREADY_EXISTS,
    message: 'Email already exists',
  },
}

export class DatabaseErrorMapper {
  static map(exception: QueryFailedError<any>): ApiException {
    const driverError = exception as QueryFailedError & {
      code?: string
      detail?: string
      constraint?: string
      table?: string
      column?: string
    }

    switch (driverError.code) {
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

  private static handleUniqueViolation(
    driverError: QueryFailedError & { constraint?: string; detail?: string; table?: string },
  ): ApiException {
    const constraint = driverError.constraint?.toLowerCase() ?? ''

    return new ApiException(
      HttpStatus.CONFLICT,
      DATABASE_CONSTRAINTS[constraint].code ?? ApiErrorCodes.CONFLICT,
      DATABASE_CONSTRAINTS[constraint].message ?? `A record with this value already exists`,
      { constraint: driverError.constraint, table: driverError.table },
    )
  }

  private static isDev(): boolean {
    return process.env.NODE_ENV !== 'production'
  }
}
