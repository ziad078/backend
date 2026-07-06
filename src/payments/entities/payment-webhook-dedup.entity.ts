import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm'

/**
 * Ensures webhook delivery idempotency per provider payment + payload hash.
 */
@Entity('payment_webhook_dedup')
@Unique('uq_payment_webhook_dedup', ['providerPaymentId', 'payloadHash'])
export class PaymentWebhookDedup {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'varchar', length: 128 })
  providerPaymentId: string

  @Column({ type: 'varchar', length: 64 })
  payloadHash: string

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
