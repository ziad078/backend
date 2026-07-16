import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm'
import { EvaluationQuestion } from './evaluation-question.entity'
import { EvaluationAttempt } from './evaluation-attempt.entity'
import { EvaluationDimension } from './evaluation-dimension.entity'
import { EvaluationType } from '../enums/evaluation-type.enum'

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'enum', enum: EvaluationType })
  type: EvaluationType

  @Column({ type: 'int', nullable: true })
  ageFrom: number | null

  @Column({ type: 'int', nullable: true })
  ageTo: number | null

  @Column({ type: 'text', array: true, default: '{}' })
  evaluatorTypes: string[]

  @Column()
  title: string

  @Column({ type: 'boolean', default: false })
  isArchived: boolean

  @Index()
  @Column({ type: 'uuid', nullable: true })
  institutionId: string | null

  @OneToMany(() => EvaluationAttempt, (a) => a.evaluation)
  attempts: EvaluationAttempt[]

  @OneToMany(() => EvaluationQuestion, (q) => q.evaluation, { cascade: true })
  questions: EvaluationQuestion[]

  @OneToMany(() => EvaluationDimension, (dimension) => dimension.evaluation, {
    cascade: true,
  })
  dimensions: EvaluationDimension[]
}
