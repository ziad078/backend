import { Injectable, Logger } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { EventEmitter2 } from 'eventemitter2'
import { DataSource } from 'typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { SubmitAttemptDto } from '../dto/submit-attempt.dto'
import { EvaluationAnswer } from '../entities/evaluation-answer.entity'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { Evaluation } from '../entities/evaluation.entity'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'
import { EVALUATION_EVENTS } from '../evaluations.events'
import { EvaluationScoringService } from '../evaluations-scoring-services.service'
import { EvaluationAccessPolicy, EvaluationActor } from './evaluation-access-policy.service'
import { EvaluationAnswerBuilderService } from './evaluation-answer-builder.service'
import { EvaluationSlotService } from './evaluation-slot.service'
import { getChildId } from 'src/common/helpers/child-resolver.helper'

type EvaluationSubmittedPayload = {
  attemptId: string
  evaluationId: string
  parentId: string
  childId: string
  score: number | null
  result: Record<string, unknown> | null
  autoSubmitted: boolean
}

@Injectable()
export class EvaluationSubmissionService {
  private readonly logger = new Logger(EvaluationSubmissionService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly access: EvaluationAccessPolicy,
    private readonly answers: EvaluationAnswerBuilderService,
    private readonly scoring: EvaluationScoringService,
    private readonly slots: EvaluationSlotService,
  ) {}

  async submitAttempt(attemptId: string, dto: SubmitAttemptDto, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.PARENT])

    let eventPayload: EvaluationSubmittedPayload | null = null

    const submitted = await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt)
      const answerRepo = manager.getRepository(EvaluationAnswer)
      const evalRepo = manager.getRepository(Evaluation)

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!attempt) throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND, 'Attempt not found')

      this.access.assertParentOwnership(attempt, actor)

      if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED, 'Attempt is locked')
      }

      const now = new Date()
      const expired =
        attempt.expiresAt instanceof Date && now.getTime() > attempt.expiresAt.getTime()

      const rows = await this.answers.buildRows(manager, attempt, dto.answers)
      await answerRepo.upsert(rows, ['attemptId', 'questionId'])

      const savedAnswers = await answerRepo.find({
        where: { attemptId: attempt.id },
        relations: {
          evaluationDimension: true,
          selectedAnswer: true,
        },
      })

      const evaluation = await evalRepo.findOne({
        where: { id: attempt.evaluationId },
        relations: {
          dimensions: true,
        },
      })

      if (!evaluation) {
        throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND, 'Evaluation not found')
      }

      const result = this.scoring.calculate(evaluation, savedAnswers)
      const totalScore =
        'totalScore' in result && typeof result.totalScore === 'number' ? result.totalScore : null

      attempt.status = EvaluationAttemptStatus.SUBMITTED
      attempt.submittedAt = now
      attempt.score = totalScore
      attempt.result = result

      attempt.status = EvaluationAttemptStatus.APPROVED
      await attemptRepo.save(attempt)
      const childId = getChildId(attempt)
      if (childId) {
        await this.slots.markPrivateAttemptCompleted(manager, attempt.id, childId)
      }

      eventPayload = {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: childId || '',
        score: totalScore,
        result,
        autoSubmitted: expired,
      }

      return attemptRepo.findOne({
        where: { id: attempt.id },
        relations: {
          answers: {
            selectedAnswer: true,
            evaluationDimension: true,
          },
          approval: true,
          evaluation: true,
        },
      })
    })

    if (eventPayload) {
      this.events.emit(EVALUATION_EVENTS.submitted, eventPayload)
    }

    return submitted
  }

  async maybeAutoSubmitIfExpired(attemptId: string) {
    let eventPayload: EvaluationSubmittedPayload | null = null

    await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt)
      const answerRepo = manager.getRepository(EvaluationAnswer)
      const evalRepo = manager.getRepository(Evaluation)

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!attempt) return
      if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) return
      if (!attempt.expiresAt) return

      const now = new Date()
      if (now.getTime() <= attempt.expiresAt.getTime()) return

      this.logger.warn(`Auto-submitting expired attempt ${attempt.id}`)

      const savedAnswers = await answerRepo.find({
        where: { attemptId: attempt.id },
        relations: {
          evaluationDimension: true,
          selectedAnswer: true,
        },
      })

      const evaluation = await evalRepo.findOne({
        where: { id: attempt.evaluationId },
        relations: {
          dimensions: true,
        },
      })

      if (!evaluation) return

      const result = this.scoring.calculate(evaluation, savedAnswers)
      const totalScore =
        'totalScore' in result && typeof result.totalScore === 'number' ? result.totalScore : null

      attempt.status = EvaluationAttemptStatus.SUBMITTED
      attempt.submittedAt = now
      attempt.score = totalScore
      attempt.result = result

      await attemptRepo.save(attempt)
      const childId = getChildId(attempt)
      if (childId) {
        await this.slots.markPrivateAttemptCompleted(manager, attempt.id, childId)
      }

      eventPayload = {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: childId || '',
        score: totalScore,
        result: attempt.result,
        autoSubmitted: true,
      }
    })

    if (eventPayload) {
      this.events.emit(EVALUATION_EVENTS.submitted, eventPayload)
    }
  }
}
