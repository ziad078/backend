import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { EventEmitter2 } from 'eventemitter2'
import { DataSource } from 'typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { EvaluationApproval } from '../entities/evaluation-approval.entity'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'
import { EVALUATION_EVENTS } from '../evaluations.events'
import { EvaluationAccessPolicy, EvaluationActor } from './evaluation-access-policy.service'
import { getChildId } from 'src/common/helpers/child-resolver.helper'

@Injectable()
export class EvaluationApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly access: EvaluationAccessPolicy,
  ) {}

  async approveAttempt(attemptId: string, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    let eventPayload: {
      attemptId: string
      evaluationId: string
      parentId: string
      childId: string
      approvedBy: string
      approvedAt: Date
    } | null = null

    const approved = await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt)
      const approvalRepo = manager.getRepository(EvaluationApproval)

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!attempt) {
        throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND, 'Attempt not found')
      }

      if (attempt.status === EvaluationAttemptStatus.APPROVED) {
        throw ApiException.conflict(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED, 'Attempt already approved')
      }

      if (attempt.status !== EvaluationAttemptStatus.SUBMITTED) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED, 'Only submitted attempts can be approved')
      }

      const existingApproval = await approvalRepo.findOne({
        where: { attemptId: attempt.id },
        lock: { mode: 'pessimistic_write' },
      })

      if (existingApproval) {
        throw ApiException.conflict(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED, 'Attempt already approved')
      }

      const approval = await approvalRepo.save(
        approvalRepo.create({
          attemptId: attempt.id,
          approvedBy: actor.userId,
        }),
      )

      attempt.status = EvaluationAttemptStatus.APPROVED
      await attemptRepo.save(attempt)

      eventPayload = {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: getChildId(attempt) || '',
        approvedBy: actor.userId,
        approvedAt: approval.approvedAt,
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
          organizationChild: true,
          privateChild: true,
        },
      })
    })

    if (eventPayload) {
      this.events.emit(EVALUATION_EVENTS.approved, eventPayload)
    }

    return approved
  }
}
