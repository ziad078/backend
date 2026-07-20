import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, Repository } from 'typeorm'
import { EvaluationAttempt } from './entities/evaluation-attempt.entity'
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum'

export type AttemptUsageSummary = {
  totalAttempts: number
  hasRetake: boolean
  lastAttempt: EvaluationAttempt | null
  inProgressAttempt: EvaluationAttempt | null
  inProgressAttempts: Array<{
    id: string
    evaluationId: string
    evaluationTitle: string | null
  }>
}

@Injectable()
export class AttemptUsageService {
  constructor(
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,
  ) {}

  async getUsage(
    childId: string,
    parentProfileId: string,
    manager?: EntityManager,
  ): Promise<AttemptUsageSummary> {
    const repo = manager?.getRepository(EvaluationAttempt) ?? this.attemptRepo
    const attempts = await repo.find({
      where: [
        { organizationChildId: childId, parentId: parentProfileId },
        { privateChildId: childId, parentId: parentProfileId },
      ],
      relations: { evaluation: true },
      order: { attemptNumber: 'ASC' },
    })

    return this.toSummary(attempts)
  }

  /**
   * Organization / teacher views: evaluation status for org children regardless of parent.
   * Single source of truth = evaluation_attempts.organizationChildId.
   */
  async getUsageByOrganizationChildIds(
    childIds: string[],
    manager?: EntityManager,
  ): Promise<Map<string, AttemptUsageSummary>> {
    const result = new Map<string, AttemptUsageSummary>()
    if (childIds.length === 0) return result

    const repo = manager?.getRepository(EvaluationAttempt) ?? this.attemptRepo
    const attempts = await repo.find({
      where: { organizationChildId: In(childIds) },
      relations: { evaluation: true },
      order: { attemptNumber: 'ASC' },
    })

    const byChild = new Map<string, EvaluationAttempt[]>()
    for (const attempt of attempts) {
      const childId = attempt.organizationChildId
      if (!childId) continue
      const list = byChild.get(childId) ?? []
      list.push(attempt)
      byChild.set(childId, list)
    }

    for (const childId of childIds) {
      result.set(childId, this.toSummary(byChild.get(childId) ?? []))
    }

    return result
  }

  private toSummary(attempts: EvaluationAttempt[]): AttemptUsageSummary {
    const completedAttempts = attempts.filter(
      (a) =>
        a.status === EvaluationAttemptStatus.SUBMITTED ||
        a.status === EvaluationAttemptStatus.APPROVED,
    )

    const inProgressAttempts = attempts.filter(
      (a) => a.status === EvaluationAttemptStatus.IN_PROGRESS,
    )

    return {
      totalAttempts: completedAttempts.length,
      hasRetake: completedAttempts.length >= 2,
      lastAttempt: attempts[attempts.length - 1] || null,
      inProgressAttempt: inProgressAttempts[0] || null,
      inProgressAttempts: inProgressAttempts.map((attempt) => ({
        id: attempt.id,
        evaluationId: attempt.evaluationId,
        evaluationTitle: attempt.evaluation?.title ?? null,
      })),
    }
  }
}
