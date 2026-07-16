import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { DataSource } from 'typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { SaveProgressDto } from '../dto/save-progress.dto'
import { EvaluationAnswer } from '../entities/evaluation-answer.entity'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'
import { EvaluationAccessPolicy, EvaluationActor } from './evaluation-access-policy.service'
import { EvaluationAnswerBuilderService } from './evaluation-answer-builder.service'
import { EvaluationSubmissionService } from './evaluation-submission.service'

@Injectable()
export class EvaluationProgressService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: EvaluationAccessPolicy,
    private readonly answers: EvaluationAnswerBuilderService,
    private readonly submissions: EvaluationSubmissionService,
  ) {}

  async saveProgress(attemptId: string, dto: SaveProgressDto, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [
      UserRole.PARENT,
      UserRole.TEACHER,
      UserRole.ORGANIZATIONOWNER,
      UserRole.ADMIN,
    ])

    await this.submissions.maybeAutoSubmitIfExpired(attemptId)

    const answers = dto.answers ?? []
    if (answers.length === 0) return

    await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt)
      const answerRepo = manager.getRepository(EvaluationAnswer)

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        relations: {
          organizationChild: {
            class: {
              organization: { owner: true },
              teacher: { user: true },
            },
          },
          privateChild: true,
          parent: true,
        },
        lock: { mode: 'pessimistic_write' },
      })

      if (!attempt) throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)

      this.access.assertCanWriteAttempt(attempt, actor)

      if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      const rows = await this.answers.buildRows(manager, attempt, answers)
      await answerRepo.upsert(rows, ['attemptId', 'questionId'])
    })
  }
}
