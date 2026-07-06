import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm'
import { EvaluationAttempt } from './evaluation-attempt.entity'

@Entity('evaluation_approvals')
@Unique('uq_attempt_approval', ['attemptId'])
export class EvaluationApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  attemptId: string

  @OneToOne(() => EvaluationAttempt, (a) => a.approval, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: EvaluationAttempt

  @Column({ type: 'uuid' })
  approvedBy: string

  @CreateDateColumn({ type: 'timestamp' })
  approvedAt: Date
}
