import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { SlotStatus } from '../enums/evaluation-slot-status.enum'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { SlotKind } from '../enums/evaluation-slot-kind.enum'
import { EvaluationAttempt } from './evaluation-attempt.entity'
import { ensureSingleChildType } from 'src/common/helpers/child-resolver.helper'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Entity('evaluation_slot')
@Index('idx_evaluation_slot_org_child_status', ['organizationChildId', 'status'])
@Index('idx_evaluation_slot_private_child_status', ['privateChildId', 'status'])
@Index('uq_evaluation_slot_org_active_kind', ['organizationChildId', 'parentId', 'kind'], {
  unique: true,
  where: `"status" IN ('READY', 'REQUESTED', 'AWAITING_PAYMENT', 'CONSUMED') AND "organizationChildId" IS NOT NULL`,
})
@Index('uq_evaluation_slot_private_active_kind', ['privateChildId', 'parentId', 'kind'], {
  unique: true,
  where: `"status" IN ('READY', 'REQUESTED', 'AWAITING_PAYMENT', 'CONSUMED') AND "privateChildId" IS NOT NULL`,
})
@Index('uq_evaluation_slot_attempt', ['evaluationAttemptId'], {
  unique: true,
  where: `"evaluationAttemptId" IS NOT NULL`,
})
export class EvaluationSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationChildId: string | null

  @ManyToOne(() => OrganizationChild, (c) => c.slots, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'organizationChildId' })
  organizationChild: OrganizationChild | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  privateChildId: string | null

  @ManyToOne(() => PrivateChild, (c) => c.slots, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'privateChildId' })
  privateChild: PrivateChild | null

  @Index()
  @Column({ type: 'uuid' })
  parentId: string

  @ManyToOne(() => ParentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile

  @Column({ type: 'enum', enum: SlotKind })
  kind: SlotKind

  @Column({ type: 'enum', enum: SlotStatus })
  status: SlotStatus

  // deprecated

  @Column({ default: false })
  isPaid: boolean

  @Column({ default: false })
  requiresApproval: boolean

  // Total attempts granted by this entitlement (>= 1). For paid EXTRA requests
  // this is the number the parent requested/paid for.
  @Column({ type: 'int', default: 1 })
  quantity: number

  // How many of `quantity` were already consumed before this slot. As each use
  // completes, a fresh READY slot is spawned carrying the incremented count,
  // keeping the "one active slot per kind" invariant while granting N attempts.
  @Column({ type: 'int', default: 0 })
  usedCount: number

  @Column({ type: 'uuid', nullable: true })
  evaluationAttemptId: string | null

  @OneToOne(() => EvaluationAttempt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'evaluationAttemptId' })
  evaluationAttempt: EvaluationAttempt | null

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  transitionTo(next: SlotStatus) {
    const validTransitions: Record<SlotStatus, SlotStatus[]> = {
      [SlotStatus.READY]: [SlotStatus.CONSUMED],

      [SlotStatus.REQUESTED]: [SlotStatus.AWAITING_PAYMENT, SlotStatus.READY],
      [SlotStatus.AWAITING_PAYMENT]: [SlotStatus.READY],
      [SlotStatus.CONSUMED]: [SlotStatus.COMPLETED],
      [SlotStatus.COMPLETED]: [],
    }

    const allowed = validTransitions[this.status] || []

    if (!allowed.includes(next)) {
      throw ApiException.badRequest(
        ApiErrorCodes.EVALUATION_INVALID_TRANSITION,
        { from: this.status, to: next },
      )
    }

    this.status = next
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateChildType() {
    ensureSingleChildType(this.organizationChildId, this.privateChildId)
  }
}
