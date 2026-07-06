import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  Unique,
} from 'typeorm'
import { Evaluation } from './evaluation.entity'
import { EvaluationQuestion } from './evaluation-question.entity'

@Entity({ name: 'evaluation_dimensions' })
@Unique('uq_evaluation_dimension_code', ['evaluationId', 'code'])
export class EvaluationDimension {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid', name: 'evaluation_id' })
  evaluationId: string

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.dimensions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation: Evaluation

  @Column({ type: 'varchar', length: 150 })
  name: string

  @Column({ type: 'varchar', length: 50 })
  code: string

  @Column('float')
  minScore: number

  @Column('float')
  maxScore: number

  @Column({ type: 'jsonb', nullable: true })
  interpretationRules: Record<string, unknown> | null

  @OneToMany(() => EvaluationQuestion, (q) => q.evaluationDimension, {
    cascade: true,
  })
  questions: EvaluationQuestion[]
}
