import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm'
import { EvaluationAttempt } from './evaluation-attempt.entity'
import { EvaluationQuestion } from './evaluation-question.entity'
import { EvaluationQuestionAnswer } from './evaluation-question-answer.entity'
import { EvaluationDimension } from './evaluation-dimension.entity'

@Entity('evaluation_answers')
@Unique('uq_attempt_question', ['attemptId', 'questionId'])
export class EvaluationAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  attemptId: string

  @ManyToOne(() => EvaluationAttempt, (a) => a.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: EvaluationAttempt

  @Index()
  @Column({ type: 'uuid' })
  questionId: string

  @ManyToOne(() => EvaluationQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: EvaluationQuestion

  @Index()
  @Column({ type: 'uuid' })
  selectedAnswerId: string

  @ManyToOne(() => EvaluationQuestionAnswer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'selectedAnswerId' })
  selectedAnswer: EvaluationQuestionAnswer

  @Index()
  @Column({ type: 'uuid' })
  evaluationDimensionId: string

  @ManyToOne(() => EvaluationDimension, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationDimensionId' })
  evaluationDimension: EvaluationDimension

  @Column('float')
  scoreValue: number
}
