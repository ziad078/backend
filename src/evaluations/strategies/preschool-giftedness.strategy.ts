import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationAnswer } from '../entities/evaluation-answer.entity'
import { EvaluationQuestion } from '../entities/evaluation-question.entity'
import { EvaluationDimension } from '../entities/evaluation-dimension.entity'
import {
  ScoringStrategy,
  EvaluationResult,
  PreschoolEvaluationResult,
  PreschoolDimensionResult,
} from './scoring-strategy.interface'
import { EvaluationType } from '../enums/evaluation-type.enum'

@Injectable()
export class PreschoolGiftednessStrategy implements ScoringStrategy {
  constructor(
    @InjectRepository(EvaluationAnswer)
    private answerRepo: Repository<EvaluationAnswer>,
    @InjectRepository(EvaluationQuestion)
    private questionRepo: Repository<EvaluationQuestion>,
    @InjectRepository(EvaluationDimension)
    private dimensionRepo: Repository<EvaluationDimension>,
  ) {}

  getType(): string {
    return EvaluationType.PRESCHOOL_GIFTEDNESS
  }

  async calculate(attempt: EvaluationAttempt): Promise<EvaluationResult> {
    const answers = await this.answerRepo.find({
      where: { attempt: { id: attempt.id } },
      relations: ['question', 'question.evaluationDimension', 'selectedAnswer'],
    })

    const dimensions = await this.dimensionRepo.find({
      where: { evaluation: { id: attempt.evaluationId } },
    })

    // 1. Calculate total score and average
    const totalScore = answers.reduce(
      (sum, answer) => sum + (answer.selectedAnswer.scoreValue || 0),
      0,
    )
    const averageScore = totalScore / 50

    // 2. Determine gifted indicator
    const giftedIndicator = averageScore > 2.5

    // 3. Determine level
    let level: 'LOW' | 'MEDIUM' | 'HIGH'
    if (totalScore >= 50 && totalScore <= 116.7) {
      level = 'LOW'
    } else if (totalScore >= 116.8 && totalScore <= 183.27) {
      level = 'MEDIUM'
    } else {
      level = 'HIGH'
    }

    // 4. Calculate dimension results
    const dimensionResults: PreschoolDimensionResult[] = []
    for (const dimension of dimensions) {
      const dimensionAnswers = answers.filter(
        (answer) => answer.question.evaluationDimensionId === dimension.id,
      )
      const dimensionTotal = dimensionAnswers.reduce(
        (sum, answer) => sum + (answer.selectedAnswer.scoreValue || 0),
        0,
      )
      const questionCount = await this.questionRepo.count({
        where: { evaluationDimensionId: dimension.id },
      })
      const dimensionAverage = dimensionTotal / questionCount

      dimensionResults.push({
        code: dimension.code,
        name: dimension.name,
        questionCount,
        totalScore: dimensionTotal,
        averageScore: dimensionAverage,
      })
    }

    return {
      totalScore,
      averageScore,
      giftedIndicator,
      level,
      dimensions: dimensionResults,
    } as PreschoolEvaluationResult
  }
}
