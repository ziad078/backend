import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { Class } from 'src/classes/entities/class.entity'
import { Grade } from 'src/grades/entities/grade.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { EvaluationAttempt } from 'src/evaluations/entities/evaluation-attempt.entity'
import { EvaluationAttemptStatus } from 'src/evaluations/enums/evaluation-attempt-status.enum'
import { AuditLog } from 'src/common/entities/audit-log.entity'
import { OrganizationsService } from './organizations.service'

export type OrganizationDashboardStats = {
  organizationId: string
  organizationName: string
  totals: {
    children: number
    teachers: number
    classes: number
    grades: number
  }
  evaluations: {
    active: number
    completed: number
    pending: number
  }
  subscription: {
    planId: string
    planNameKey: string
    statusKey: string
    remainingDays: number | null
  }
  charts: {
    childrenPerGrade: Array<{ gradeId: string; gradeName: string; count: number }>
    evaluationCompletionRate: number | null
    monthlyActivity: Array<{ month: string; count: number }>
  }
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    entityId: string
    titleKey: string
    titleValues?: Record<string, string>
    createdAt: string
  }>
}

@Injectable()
export class OrganizationDashboardService {
  constructor(
    private readonly organizationsService: OrganizationsService,
    @InjectRepository(Grade)
    private readonly grades: Repository<Grade>,
    @InjectRepository(Class)
    private readonly classes: Repository<Class>,
    @InjectRepository(Teacher)
    private readonly teachers: Repository<Teacher>,
    @InjectRepository(OrganizationChild)
    private readonly organizationChildren: Repository<OrganizationChild>,
    @InjectRepository(EvaluationAttempt)
    private readonly attempts: Repository<EvaluationAttempt>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async getDashboardForOwner(ownerUserId: string): Promise<OrganizationDashboardStats> {
    const org = await this.organizationsService.findByOwner(ownerUserId)
    const organizationId = org.id

    const [gradesCount, classesCount, teachersCount, childrenCount] = await Promise.all([
      this.grades.count({ where: { organization: { id: organizationId } } }),
      this.classes.count({ where: { organization: { id: organizationId } } }),
      this.teachers.count({ where: { organization: { id: organizationId } } }),
      this.organizationChildren.count({ where: { organization: { id: organizationId } } }),
    ])

    const attemptRows = await this.attempts
      .createQueryBuilder('attempt')
      .innerJoin('attempt.organizationChild', 'child')
      .where('child.organizationId = :organizationId', { organizationId })
      .select('attempt.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('attempt.status')
      .getRawMany<{ status: EvaluationAttemptStatus; count: string }>()

    const statusCounts = new Map<string, number>()
    for (const row of attemptRows) {
      statusCounts.set(row.status, Number(row.count))
    }

    const inProgress = statusCounts.get(EvaluationAttemptStatus.IN_PROGRESS) ?? 0
    const submitted = statusCounts.get(EvaluationAttemptStatus.SUBMITTED) ?? 0
    const approved = statusCounts.get(EvaluationAttemptStatus.APPROVED) ?? 0
    const completed = submitted + approved

    const childrenPerGrade = await this.grades
      .createQueryBuilder('grade')
      .leftJoin('grade.classes', 'class')
      .leftJoin('class.children', 'child')
      .where('grade.organizationId = :organizationId', { organizationId })
      .select('grade.id', 'gradeId')
      .addSelect('grade.name', 'gradeName')
      .addSelect('COUNT(DISTINCT child.id)', 'count')
      .groupBy('grade.id')
      .addGroupBy('grade.name')
      .orderBy('grade.name', 'ASC')
      .getRawMany<{ gradeId: string; gradeName: string; count: string }>()

    const totalEvalAttempts = inProgress + completed
    const evaluationCompletionRate =
      totalEvalAttempts > 0 ? Math.round((completed / totalEvalAttempts) * 100) : null

    const monthlyActivity = await this.auditLogs
      .createQueryBuilder('log')
      .where('log.userId = :ownerUserId', { ownerUserId })
      .andWhere('log.createdAt >= :since', {
        since: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      })
      .select("TO_CHAR(log.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(log.createdAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany<{ month: string; count: string }>()

    const recentLogs = await this.auditLogs.find({
      where: { userId: ownerUserId },
      order: { createdAt: 'DESC' },
      take: 12,
    })

    return {
      organizationId,
      organizationName: org.organizationName,
      totals: {
        children: childrenCount,
        teachers: teachersCount,
        classes: classesCount,
        grades: gradesCount,
      },
      evaluations: {
        active: inProgress,
        completed: approved,
        pending: submitted,
      },
      subscription: {
        planId: 'free',
        planNameKey: 'subscription.plans.free.name',
        statusKey: 'subscription.status.active',
        remainingDays: null,
      },
      charts: {
        childrenPerGrade: childrenPerGrade.map((row) => ({
          gradeId: row.gradeId,
          gradeName: row.gradeName,
          count: Number(row.count),
        })),
        evaluationCompletionRate,
        monthlyActivity: monthlyActivity.map((row) => ({
          month: row.month,
          count: Number(row.count),
        })),
      },
      recentActivity: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        titleKey: this.activityTitleKey(log.action, log.entityType),
        titleValues: log.description ? { detail: log.description } : undefined,
        createdAt: log.createdAt.toISOString(),
      })),
    }
  }

  private activityTitleKey(action: string, entityType: string): string {
    const entity = entityType.toLowerCase()
    if (action === 'CREATE') {
      if (entity.includes('child')) return 'activity.childAdded'
      if (entity.includes('teacher')) return 'activity.teacherCreated'
      if (entity.includes('class')) return 'activity.classCreated'
      if (entity.includes('grade')) return 'activity.gradeCreated'
    }
    if (action === 'UPDATE') {
      if (entity.includes('grade')) return 'activity.gradeUpdated'
      if (entity.includes('class')) return 'activity.classUpdated'
      if (entity.includes('teacher')) return 'activity.teacherUpdated'
      if (entity.includes('child')) return 'activity.childUpdated'
    }
    if (action === 'EVALUATION_SUBMIT') {
      return 'activity.evaluationCompleted'
    }
    if (action === 'EVALUATION_START') {
      return 'activity.evaluationAssigned'
    }
    if (action === 'EVALUATION_APPROVE') {
      return 'activity.evaluationApproved'
    }
    return 'activity.generic'
  }
}
