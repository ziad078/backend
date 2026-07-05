/**
 * PostgreSQL error codes we care about.
 * راجع القائمة الكاملة هنا: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export enum PgErrorCode {
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  CHECK_VIOLATION = '23514',
}
