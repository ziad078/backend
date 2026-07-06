import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'
import { AuditAction } from '../enums/audit-action.enum'

@Entity('audit_logs')
@Index('idx_audit_logs_user', ['userId'])
@Index('idx_audit_logs_action', ['action'])
@Index('idx_audit_logs_entity', ['entityType', 'entityId'])
@Index('idx_audit_logs_date', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 255 })
  userEmail: string

  @Column({ type: 'varchar', length: 50 })
  userRole: string

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction

  @Column({ type: 'varchar', length: 100 })
  entityType: string

  @Column({ type: 'uuid' })
  entityId: string

  @Column({ type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null

  @CreateDateColumn()
  createdAt: Date
}
