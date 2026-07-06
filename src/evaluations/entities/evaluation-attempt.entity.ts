import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { Evaluation } from './evaluation.entity'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'
import { EvaluationAnswer } from './evaluation-answer.entity'
import { EvaluationApproval } from './evaluation-approval.entity'
import { EvaluationSlot } from './evaluation-slot.entity'
import { ensureSingleChildType } from 'src/common/helpers/child-resolver.helper'

@Entity('evaluation_attempts')
@Unique('uq_eval_attempt_org_number', [
  'evaluationId',
  'parentId',
  'organizationChildId',
  'attemptNumber',
])
@Unique('uq_eval_attempt_private_number', [
  'evaluationId',
  'parentId',
  'privateChildId',
  'attemptNumber',
])
@Index('idx_eval_attempt_org_lookup', ['evaluationId', 'parentId', 'organizationChildId'])
@Index('idx_eval_attempt_private_lookup', ['evaluationId', 'parentId', 'privateChildId'])
@Index('uq_eval_attempt_org_in_progress', ['evaluationId', 'parentId', 'organizationChildId'], {
  unique: true,
  where: `"status" = 'in_progress' AND "organizationChildId" IS NOT NULL`,
})
@Index('uq_eval_attempt_private_in_progress', ['evaluationId', 'parentId', 'privateChildId'], {
  unique: true,
  where: `"status" = 'in_progress' AND "privateChildId" IS NOT NULL`,
})
export class EvaluationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  parentId: string

  @ManyToOne(() => ParentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationChildId: string | null

  @ManyToOne(() => OrganizationChild, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationChildId' })
  organizationChild: OrganizationChild | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  privateChildId: string | null

  @ManyToOne(() => PrivateChild, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'privateChildId' })
  privateChild: PrivateChild | null

  @Index()
  @Column({ type: 'uuid' })
  evaluationId: string

  @ManyToOne(() => Evaluation, (e) => e.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation

  @Column({ type: 'int' })
  attemptNumber: number // 1 or 2

  @Column({ type: 'enum', enum: EvaluationAttemptStatus })
  status: EvaluationAttemptStatus

  @Column('float', { nullable: true })
  score: number | null

  @CreateDateColumn({ type: 'timestamp' })
  startedAt: Date

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null

  @OneToMany(() => EvaluationAnswer, (a) => a.attempt, { cascade: true })
  answers: EvaluationAnswer[]

  @OneToOne(() => EvaluationApproval, (ap) => ap.attempt, { nullable: true })
  approval: EvaluationApproval | null

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null

  @OneToOne(() => EvaluationSlot, (slot) => slot.evaluationAttempt)
  slot: EvaluationSlot

  @BeforeInsert()
  @BeforeUpdate()
  validateChildType() {
    ensureSingleChildType(this.organizationChildId, this.privateChildId)
  }
}
