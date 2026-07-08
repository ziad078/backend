import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { EntityManager, In } from 'typeorm'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationQuestion } from '../entities/evaluation-question.entity'

export type EvaluationAnswerInput = {
  questionId: string
  selectedAnswerId: string
}

export type EvaluationAnswerRow = {
  attemptId: string
  questionId: string
  selectedAnswerId: string
  evaluationDimensionId: string
  scoreValue: number
}

@Injectable()
export class EvaluationAnswerBuilderService {
  async buildRows(
    manager: EntityManager,
    attempt: EvaluationAttempt,
    inputs: EvaluationAnswerInput[],
  ): Promise<EvaluationAnswerRow[]> {
    if (!inputs.length) return []

    const questionIds = inputs.map((answer) => answer.questionId)
    const duplicatedQuestionIds = this.findDuplicates(questionIds)

    if (duplicatedQuestionIds.length > 0) {
      throw ApiException.badRequest(ApiErrorCodes.EVALUATION_DUPLICATE_ANSWERS, `Duplicate answers for questions: ${duplicatedQuestionIds.join(', ')}`)
    }

    const questions = await manager.getRepository(EvaluationQuestion).find({
      where: {
        id: In(questionIds),
        evaluationId: attempt.evaluationId,
      },
      relations: {
        answers: true,
        evaluationDimension: true,
      },
    })

    const questionMap = new Map<string, EvaluationQuestion>(
      questions.map((question) => [question.id, question]),
    )

    if (questionMap.size !== questionIds.length) {
      throw ApiException.badRequest(ApiErrorCodes.EVALUATION_INVALID_QUESTION, 'One or more questions do not belong to this evaluation')
    }

    return inputs.map((input) => {
      const question = questionMap.get(input.questionId)
      if (!question) throw ApiException.badRequest(ApiErrorCodes.EVALUATION_INVALID_QUESTION, 'Invalid question')

      const selected = question.answers.find((answer) => answer.id === input.selectedAnswerId)

      if (!selected) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_INVALID_ANSWER, 'Selected answer does not belong to question')
      }

      return {
        attemptId: attempt.id,
        questionId: question.id,
        selectedAnswerId: selected.id,
        evaluationDimensionId: question.evaluationDimensionId,
        scoreValue: Number(selected.scoreValue),
      }
    })
  }

  private findDuplicates(values: string[]) {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    for (const value of values) {
      if (seen.has(value)) duplicates.add(value)
      seen.add(value)
    }

    return [...duplicates]
  }
}
