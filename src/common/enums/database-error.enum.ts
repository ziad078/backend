/**
 * PostgreSQL SQLSTATE error codes used by the application.
 *
 * Docs:
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export enum PgErrorCode {
  // ==========================
  // Integrity Constraint Violations (Class 23)
  // ==========================

  /** duplicate key value violates unique constraint */
  UNIQUE_VIOLATION = '23505',

  /** insert/update violates foreign key constraint */
  FOREIGN_KEY_VIOLATION = '23503',

  /** null value in column violates not-null constraint */
  NOT_NULL_VIOLATION = '23502',

  /** check constraint failed */
  CHECK_VIOLATION = '23514',

  /** exclusion constraint failed */
  EXCLUSION_VIOLATION = '23P01',

  /** restrict violation */
  RESTRICT_VIOLATION = '23001',

  // ==========================
  // Transaction Errors
  // ==========================

  /** concurrent update conflict */
  SERIALIZATION_FAILURE = '40001',

  /** deadlock detected */
  DEADLOCK_DETECTED = '40P01',

  // ==========================
  // Query / Schema Errors
  // ==========================

  /** relation does not exist */
  UNDEFINED_TABLE = '42P01',

  /** column does not exist */
  UNDEFINED_COLUMN = '42703',

  /** syntax error */
  SYNTAX_ERROR = '42601',

  /** undefined function */
  UNDEFINED_FUNCTION = '42883',

  // ==========================
  // Connection Errors
  // ==========================

  CONNECTION_FAILURE = '08006',

  CONNECTION_DOES_NOT_EXIST = '08003',

  CONNECTION_REJECTED = '08004',

  // ==========================
  // Query Execution
  // ==========================

  QUERY_CANCELED = '57014',
}
