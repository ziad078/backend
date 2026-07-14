import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository, IsNull } from 'typeorm'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAttempt } from './entities/evaluation-attempt.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { Class } from 'src/classes/entities/class.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import { UserRole } from 'src/common/enums/role.enum'
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { getChildId } from 'src/common/helpers/child-resolver.helper'

type Actor = {
  userId: string
  roles: UserRole[]
}

type OwnerFilters = {
  evaluationId?: string
}

type ResultDimension = {
  code?: string
  name?: string
  score?: number
  percentage?: number | null
  level?: string | null
  dominantPole?: string | null
  strength?: string | null
}

type EvaluationOwnerStatus =
  | 'not_started'
  | EvaluationAttemptStatus.IN_PROGRESS
  | EvaluationAttemptStatus.SUBMITTED
  | EvaluationAttemptStatus.APPROVED

@Injectable()
export class OwnerEvaluationResultsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,

    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,

    @InjectRepository(OrganizationChild)
    private readonly orgChildRepo: Repository<OrganizationChild>,

    @InjectRepository(PrivateChild)
    private readonly privateChildRepo: Repository<PrivateChild>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,

    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,

    private readonly notificationsService: NotificationsService,
  ) {}

  async getFilters(actor: Actor) {
    const organizationId = await this.resolveOrganizationId(actor)

    const classes = await this.classRepo.find({
      where: { organization: { id: organizationId } },
      order: { name: 'ASC' },
    })

    const evaluations = await this.evaluationRepo.find({
      where: [{ institutionId: organizationId }, { institutionId: IsNull() }],
      order: { title: 'ASC' },
    })

    return {
      classes: classes.map((cls) => ({
        id: cls.id,
        name: cls.name,
      })),
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        title: evaluation.title,
        type: evaluation.type,
        ageFrom: evaluation.ageFrom,
        ageTo: evaluation.ageTo,
      })),
    }
  }

  async getReports(actor: Actor, filters: OwnerFilters) {
    const organizationId = await this.resolveOrganizationId(actor)

    const classes = await this.classRepo.find({
      where: { organization: { id: organizationId } },
      relations: { children: true },
      order: { name: 'ASC' },
    })

    const evaluation = filters.evaluationId
      ? await this.evaluationRepo.findOne({
          where: [
            {
              id: filters.evaluationId,
              institutionId: organizationId,
            },
            {
              id: filters.evaluationId,
              institutionId: IsNull(),
            },
          ],
        })
      : null

    if (filters.evaluationId && !evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    const classIds = classes.map((cls) => cls.id)

    const children = await this.orgChildRepo.find({
      where: {
        class: {
          id: In(classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000']),
        },
      },
      relations: { class: true },
    })

    const childIds = children.map((child) => child.id)

    const attempts = childIds.length
      ? await this.attemptRepo.find({
          where: [
            {
              organizationChildId: In(childIds),
              ...(filters.evaluationId ? { evaluationId: filters.evaluationId } : {}),
            },
          ],
        })
      : []

    const evaluatedChildIds = new Set(
      attempts
        .filter(
          (attempt) =>
            attempt.status === EvaluationAttemptStatus.SUBMITTED ||
            attempt.status === EvaluationAttemptStatus.APPROVED,
        )
        .map((attempt) => getChildId(attempt))
        .filter((id): id is string => id !== null),
    )

    return {
      reports: classes.map((cls) => {
        const classChildren = children.filter((child) => child.class?.id === cls.id)

        return {
          classId: cls.id,
          className: cls.name,
          evaluationId: evaluation?.id ?? null,
          evaluationTitle: evaluation?.title ?? 'كل التقييمات',
          title: evaluation ? `تقرير ${cls.name} - ${evaluation.title}` : `تقرير ${cls.name}`,
          childrenCount: classChildren.length,
          evaluatedCount: classChildren.filter((child) => evaluatedChildIds.has(child.id)).length,
          reportDate: new Date().toISOString().slice(0, 10),
        }
      }),
    }
  }

  async getClassEvaluationSummary(classId: string, evaluationId: string, actor: Actor) {
    const organizationId = await this.resolveOrganizationId(actor)

    const cls = await this.classRepo.findOne({
      where: {
        id: classId,
        organization: { id: organizationId },
      },
      relations: {
        children: true,
      },
    })

    if (!cls) {
      throw ApiException.notFound(ApiErrorCodes.CLASS_NOT_FOUND)
    }

    const evaluation = await this.evaluationRepo.findOne({
      where: [
        {
          id: evaluationId,
          institutionId: organizationId,
        },
        {
          id: evaluationId,
          institutionId: IsNull(),
        },
      ],
    })

    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    const children = cls.children ?? []
    const childIds = children.map((child) => child.id)

    if (!childIds.length) {
      return this.emptyClassSummary(cls.id, cls.name, evaluation.id, evaluation.title)
    }

    const attempts = await this.attemptRepo.find({
      where: [
        { organizationChildId: In(childIds), evaluationId },
        { privateChildId: In(childIds), evaluationId },
      ],
      relations: {
        organizationChild: true,
        privateChild: true,
        evaluation: true,
      },
      order: {
        submittedAt: 'DESC',
        startedAt: 'DESC',
      },
    })

    const latestByChild = this.getLatestAttemptByChild(attempts)

    // النتائج الإحصائية لصاحب المؤسسة تعتمد على المحاولات المعتمدة فقط
    const approvedAttempts = [...latestByChild.values()].filter(
      (attempt) => attempt.status === EvaluationAttemptStatus.APPROVED,
    )

    const scores = approvedAttempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => typeof score === 'number')

    const highestScore = scores.length ? Math.max(...scores) : null
    const lowestScore = scores.length ? Math.min(...scores) : null
    const averageScore = scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : null

    const topDimensions = this.calculateTopDimensions(approvedAttempts)

    return {
      classId: cls.id,
      className: cls.name,
      evaluationId: evaluation.id,
      evaluationTitle: evaluation.title,
      evaluationType: evaluation.type,
      totalChildren: children.length,
      approvedCount: approvedAttempts.length,
      submittedCount: [...latestByChild.values()].filter(
        (attempt) => attempt.status === EvaluationAttemptStatus.SUBMITTED,
      ).length,
      inProgressCount: [...latestByChild.values()].filter(
        (attempt) => attempt.status === EvaluationAttemptStatus.IN_PROGRESS,
      ).length,
      notStartedCount: children.length - [...latestByChild.values()].filter(Boolean).length,
      highestScore,
      averageScore,
      lowestScore,
      topDimensions,
      children: children.map((child) => {
        const attempt = latestByChild.get(child.id)
        const topDimension = this.getTopDimensionFromAttempt(attempt)

        return {
          organizationChildId: child.id,
          childName: child.name,
          className: cls.name,
          status: this.resolveAttemptStatus(attempt),
          statusLabel: this.statusLabel(this.resolveAttemptStatus(attempt)),
          attemptId: attempt?.id ?? null,
          score: typeof attempt?.score === 'number' ? attempt.score : null,
          topResultLabel:
            topDimension?.dominantPole ?? topDimension?.level ?? topDimension?.name ?? null,
          topDimensionName: topDimension?.name ?? null,
          topDimensionPercentage: topDimension?.percentage ?? null,
        }
      }),
    }
  }

  async getClassEvaluationStatus(classId: string, evaluationId: string, actor: Actor) {
    const organizationId = await this.resolveOrganizationId(actor)

    const cls = await this.classRepo.findOne({
      where: {
        id: classId,
        organization: { id: organizationId },
      },
      relations: {
        children: true,
      },
    })

    if (!cls) {
      throw ApiException.notFound(ApiErrorCodes.CLASS_NOT_FOUND)
    }

    const evaluation = await this.evaluationRepo.findOne({
      where: [
        {
          id: evaluationId,
          institutionId: organizationId,
        },
        {
          id: evaluationId,
          institutionId: IsNull(),
        },
      ],
    })

    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    const children = cls.children ?? []
    const childIds = children.map((child) => child.id)

    const attempts = childIds.length
      ? await this.attemptRepo.find({
          where: {
            organizationChildId: In(childIds),
            evaluationId,
          },
          order: {
            submittedAt: 'DESC',
            startedAt: 'DESC',
          },
        })
      : []

    const latestByChild = this.getLatestAttemptByChild(attempts)

    return {
      classId: cls.id,
      className: cls.name,
      evaluationId: evaluation.id,
      evaluationTitle: evaluation.title,
      children: children.map((child) => {
        const attempt = latestByChild.get(child.id)
        const status = this.resolveAttemptStatus(attempt)

        return {
          organizationChildId: child.id,
          childName: child.name,
          className: cls.name,
          status,
          statusLabel: this.statusLabel(status),
          lastAttemptId: attempt?.id ?? null,
          canSendReminder:
            status === 'not_started' || status === EvaluationAttemptStatus.IN_PROGRESS,
        }
      }),
    }
  }

  async sendReminder(childId: string, actor: Actor) {
    const organizationId = await this.resolveOrganizationId(actor)

    const child = await this.orgChildRepo.findOne({
      where: {
        id: childId,
        class: { organization: { id: organizationId } },
      },
      relations: {
        parent: true,
        class: true,
      },
    })

    if (!child) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    if (!child.parent?.id) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    await this.notificationsService.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: child.parent.userId,
      title: 'تذكير بالتقييم',
      message: `برجاء استكمال تقييم الطفل ${child.name}.`,
      type: 'evaluation_reminder',
      metadata: {
        childId: child.id,
        classId: child.class?.id ?? null,
        sentBy: actor.userId,
      },
    })

    return {
      message: 'Reminder sent successfully',
    }
  }

  private async resolveOrganizationId(actor: Actor): Promise<string> {
    // if (actor.roles.includes(UserRole.ADMIN)) {
    //   // للـ Admin الأفضل لاحقًا تبعت organizationId في query
    //   // هنا نمنع استخدام Admin بدون organization context
    //   throw new ForbiddenException(
    //     'Admin must use organization-scoped endpoint with organizationId',
    //   );
    // }

    if (!actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    const organization = await this.organizationRepo.findOne({
      where: {
        owner: { id: actor.userId },
      },
    })

    if (!organization) {
      throw ApiException.forbidden(ApiErrorCodes.ORGANIZATION_NOT_FOUND)
    }

    return organization.id
  }

  private emptyClassSummary(
    classId: string,
    className: string,
    evaluationId: string,
    evaluationTitle: string,
  ) {
    return {
      classId,
      className,
      evaluationId,
      evaluationTitle,
      totalChildren: 0,
      approvedCount: 0,
      submittedCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
      highestScore: null,
      averageScore: null,
      lowestScore: null,
      topDimensions: [],
      children: [],
    }
  }

  private getLatestAttemptByChild(attempts: EvaluationAttempt[]) {
    const map = new Map<string, EvaluationAttempt>()

    for (const attempt of attempts) {
      const childId = getChildId(attempt)
      if (childId && !map.has(childId)) {
        map.set(childId, attempt)
      }
    }

    return map
  }

  private resolveAttemptStatus(attempt?: EvaluationAttempt): EvaluationOwnerStatus {
    if (!attempt) return 'not_started'

    return attempt.status
  }

  private statusLabel(status: EvaluationOwnerStatus) {
    switch (status) {
      case EvaluationAttemptStatus.IN_PROGRESS:
        return 'قيد التنفيذ'
      case EvaluationAttemptStatus.SUBMITTED:
        return 'تم الإرسال'
      case EvaluationAttemptStatus.APPROVED:
        return 'معتمد'
      case 'not_started':
      default:
        return 'لم يبدأ بعد'
    }
  }

  private calculateTopDimensions(attempts: EvaluationAttempt[]) {
    const dimensionMap = new Map<
      string,
      {
        code: string
        name: string
        scoreSum: number
        scoreCount: number
        percentageSum: number
        percentageCount: number
      }
    >()

    for (const attempt of attempts) {
      const dimensions = this.extractDimensions(attempt)

      for (const dimension of dimensions) {
        if (!dimension.code || !dimension.name) continue

        const current = dimensionMap.get(dimension.code) ?? {
          code: dimension.code,
          name: dimension.name,
          scoreSum: 0,
          scoreCount: 0,
          percentageSum: 0,
          percentageCount: 0,
        }

        if (typeof dimension.score === 'number') {
          current.scoreSum += dimension.score
          current.scoreCount += 1
        }

        if (typeof dimension.percentage === 'number') {
          current.percentageSum += dimension.percentage
          current.percentageCount += 1
        }

        dimensionMap.set(dimension.code, current)
      }
    }

    return [...dimensionMap.values()]
      .map((dimension) => ({
        code: dimension.code,
        name: dimension.name,
        score:
          dimension.scoreCount > 0
            ? Number((dimension.scoreSum / dimension.scoreCount).toFixed(2))
            : 0,
        percentage:
          dimension.percentageCount > 0
            ? Number((dimension.percentageSum / dimension.percentageCount).toFixed(2))
            : null,
      }))
      .sort((a, b) => {
        const aValue = a.percentage ?? a.score
        const bValue = b.percentage ?? b.score
        return bValue - aValue
      })
      .slice(0, 3)
  }

  private getTopDimensionFromAttempt(attempt?: EvaluationAttempt) {
    if (!attempt) return null

    const dimensions = this.extractDimensions(attempt)

    if (!dimensions.length) return null

    return [...dimensions].sort((a, b) => {
      const aValue = a.percentage ?? a.score ?? 0
      const bValue = b.percentage ?? b.score ?? 0
      return bValue - aValue
    })[0]
  }

  private extractDimensions(attempt: EvaluationAttempt): ResultDimension[] {
    const result = attempt.result

    if (!this.isRecord(result)) return []

    const dimensions = result.dimensions

    if (!Array.isArray(dimensions)) return []

    return dimensions
      .filter((dimension) => this.isRecord(dimension))
      .map((dimension) => ({
        code: typeof dimension.code === 'string' ? dimension.code : undefined,
        name: typeof dimension.name === 'string' ? dimension.name : undefined,
        score: typeof dimension.score === 'number' ? dimension.score : undefined,
        percentage: typeof dimension.percentage === 'number' ? dimension.percentage : null,
        level: typeof dimension.level === 'string' ? dimension.level : null,
        dominantPole: typeof dimension.dominantPole === 'string' ? dimension.dominantPole : null,
        strength: typeof dimension.strength === 'string' ? dimension.strength : null,
      }))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
