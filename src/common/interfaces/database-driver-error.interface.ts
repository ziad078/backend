import { TypeORMError } from 'typeorm'

export interface DatabaseDriverError extends TypeORMError {
  code: string
  detail?: string
  column?: string
  table?: string
}
