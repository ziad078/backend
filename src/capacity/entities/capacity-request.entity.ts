import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { CapacityRequestStatus } from 'src/common/enums/capacity-request-status.enum'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { Payment } from 'src/payments/entities/payment.entity'

@Entity('capacity_requests')
@Index('idx_capacity_parent', ['parentId'])
@Index('idx_capacity_status', ['status'])
export class CapacityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  parentId: string

  @ManyToOne(() => ParentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile

  @Column({ type: 'int' })
  requestedCapacity: number

  @Column({
    type: 'enum',
    enum: CapacityRequestStatus,
    default: CapacityRequestStatus.PENDING,
  })
  status: CapacityRequestStatus

  @Index()
  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
