import { Entity, PrimaryGeneratedColumn, Index, Column, ManyToOne, JoinColumn } from 'typeorm'
import { EvaluationQuestion } from './evaluation-question.entity'

@Entity('evaluation_question_answers')
export class EvaluationQuestionAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  questionId: string

  @ManyToOne(() => EvaluationQuestion, (q) => q.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question: EvaluationQuestion

  @Column({ type: 'text' })
  text: string

  @Column('float')
  scoreValue: number

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null

  @Column({ type: 'int', default: 1 })
  order: number
}
