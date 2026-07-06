import { SetMetadata } from '@nestjs/common'
import { AuditAction } from '../enums/audit-action.enum'

export const AUDIT_LOG_KEY = 'audit_log'

export interface AuditLogMetadata {
  action: AuditAction
  entityType: string
  getEntityId?: (data: any) => string
  getOldValue?: (data: any) => any
  getNewValue?: (data: any) => any
}

export const AuditLog = (metadata: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, metadata)
