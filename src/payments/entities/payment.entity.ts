import { User } from 'src/users/entities/user.entity'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { PaymentStatusEnum } from '../enums/payment-status.enum'
import { PaymentProviderEnum } from '../enums/payment-provider.enum'

export type PaymentMetadata = {
  privateChildId?: string
  attemptRequestId?: string
  privateAttemptId?: string
  description?: string
  [key: string]: unknown
}

@Entity('payments')
@Index('idx_payments_pending_expiry', ['status', 'expiresAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User

  @Index()
  @Column({ type: 'uuid', nullable: true })
  privateChildId: string | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  privateAttemptId: string | null

  @Column({ type: 'varchar', length: 2048, nullable: true })
  paymentUrl: string | null

  /**
   * Amount in major units (SAR), stored with 2 decimal places.
   */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string

  @Column({ length: 3, default: 'SAR' })
  currency: string

  @Column({ type: 'enum', enum: PaymentStatusEnum })
  status: PaymentStatusEnum

  @Column({ type: 'enum', enum: PaymentProviderEnum })
  provider: PaymentProviderEnum

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  providerPaymentId: string | null

  @Column({ type: 'jsonb', default: {} })
  metadata: PaymentMetadata

  @Column({ type: 'int', default: 0 })
  retryCount: number

  @Column({ type: 'int', default: 3 })
  maxRetries: number

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date
}
