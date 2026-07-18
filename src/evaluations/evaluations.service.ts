import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { CreateEvaluationDto } from './dto/create-evaluation.dto'
import { UpdateEvaluationDto } from './dto/update-evaluation.dto'
import { SaveProgressDto } from './dto/save-progress.dto'
import { StartEvaluationDto } from './dto/start-evaluation.dto'
import { SubmitAttemptDto } from './dto/submit-attempt.dto'
import { EvaluationAttempt } from './entities/evaluation-attempt.entity'
import { EvaluationDimension } from './entities/evaluation-dimension.entity'
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity'
import { EvaluationQuestion } from './entities/evaluation-question.entity'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum'
import {
  EvaluationAccessPolicy,
  EvaluationActor,
} from './services/evaluation-access-policy.service'
import { EvaluationApprovalService } from './services/evaluation-approval.service'
import { EvaluationAttemptLifecycleService } from './services/evaluation-attempt-lifecycle.service'
import { EvaluationProgressService } from './services/evaluation-progress.service'
import { EvaluationSubmissionService } from './services/evaluation-submission.service'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { PaginationQueryDto, buildPaginationMeta } from 'src/common/dto/pagination-query.dto'

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: EvaluationAccessPolicy,
    private readonly lifecycle: EvaluationAttemptLifecycleService,
    private readonly progress: EvaluationProgressService,
    private readonly submissions: EvaluationSubmissionService,
    private readonly approvals: EvaluationApprovalService,

    @InjectRepository(Evaluation)
    private readonly evalRepo: Repository<Evaluation>,

    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,

    @InjectRepository(EvaluationQuestion)
    private readonly questionRepo: Repository<EvaluationQuestion>,

    @InjectRepository(EvaluationQuestionAnswer)
    private readonly questionAnswerRepo: Repository<EvaluationQuestionAnswer>,

    @InjectRepository(EvaluationDimension)
    private readonly dimensionRepo: Repository<EvaluationDimension>,
    private readonly parentProfilesService: ParentProfilesService,
    @InjectRepository(OrganizationChild)
    private readonly organizationChildrenRepository: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private readonly privateChildrenRepository: Repository<PrivateChild>,
  ) {}

  async createEvaluation(dto: CreateEvaluationDto, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    return this.dataSource.transaction(async (manager) => {
      const evaluationRepo = manager.getRepository(Evaluation)
      const dimensionRepo = manager.getRepository(EvaluationDimension)
      const questionRepo = manager.getRepository(EvaluationQuestion)

      const duplicatedCodes = this.findDuplicates(dto.dimensions.map((dimension) => dimension.code))
      if (duplicatedCodes.length > 0) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_DUPLICATE_DIMENSIONS, { codes: duplicatedCodes })
      }

      const evaluation = await evaluationRepo.save(
        evaluationRepo.create({
          title: dto.title,
          type: dto.type,
          institutionId: dto.institutionId,
          ageFrom: dto.ageFrom ?? null,
          ageTo: dto.ageTo ?? null,
          evaluatorTypes: dto.evaluatorTypes ?? [],
        }),
      )

      const dimensions = await dimensionRepo.save(
        dto.dimensions.map((dimension) =>
          dimensionRepo.create({
            evaluationId: evaluation.id,
            name: dimension.name,
            code: dimension.code,
            minScore: dimension.minScore,
            maxScore: dimension.maxScore,
            interpretationRules: dimension.interpretationRules ?? null,
          }),
        ),
      )

      const dimensionByCode = new Map(dimensions.map((dimension) => [dimension.code, dimension]))

      for (const [index, questionDto] of dto.questions.entries()) {
        const dimension = dimensionByCode.get(questionDto.dimensionCode)

        if (!dimension) {
          throw ApiException.badRequest(ApiErrorCodes.EVALUATION_DIMENSION_MISSING, { dimensionCode: questionDto.dimensionCode })
        }

        await questionRepo.save(
          questionRepo.create({
            evaluationId: evaluation.id,
            evaluationDimensionId: dimension.id,
            content: questionDto.content,
            order: questionDto.order ?? index + 1,
            answers: questionDto.answers.map((answerDto, answerIndex) => ({
              text: answerDto.text,
              scoreValue: answerDto.scoreValue,
              code: answerDto.code ?? null,
              order: answerIndex + 1,
            })),
          }),
        )
      }

      return evaluationRepo.findOne({
        where: { id: evaluation.id },
        relations: {
          dimensions: true,
          questions: {
            answers: true,
            evaluationDimension: true,
          },
        },
        order: {
          questions: {
            order: 'ASC',
            answers: {
              order: 'ASC',
            },
          },
        },
      })
    })
  }

  async getAllEvaluationsForAdmin(actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    return this.evalRepo.find({
      relations: {
        dimensions: true,
      },
      order: { title: 'ASC' },
    })
  }

  async getEvaluationDetailsForAdmin(evaluationId: string, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
      relations: {
        dimensions: true,
        questions: {
          answers: true,
          evaluationDimension: true,
        },
      },
      order: {
        questions: {
          order: 'ASC',
          answers: {
            order: 'ASC',
          },
        },
      },
    })

    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    return evaluation
  }

  async updateEvaluation(evaluationId: string, dto: UpdateEvaluationDto, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    const evaluation = await this.evalRepo.findOne({ where: { id: evaluationId } })
    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    if (dto.title !== undefined) evaluation.title = dto.title
    if (dto.ageFrom !== undefined) evaluation.ageFrom = dto.ageFrom
    if (dto.ageTo !== undefined) evaluation.ageTo = dto.ageTo
    if (dto.isArchived !== undefined) evaluation.isArchived = dto.isArchived

    return this.evalRepo.save(evaluation)
  }

  async getEvaluationForm(evaluationId: string, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.PARENT, UserRole.ADMIN])

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
      relations: {
        dimensions: true,
        questions: {
          answers: true,
          evaluationDimension: true,
        },
      },
      order: {
        questions: {
          order: 'ASC',
          answers: {
            order: 'ASC',
          },
        },
      },
    })

    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    if (evaluation.isArchived && actor.roles.includes(UserRole.PARENT)) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    return {
      id: evaluation.id,
      title: evaluation.title,
      type: evaluation.type,
      institutionId: evaluation.institutionId,
      ageFrom: evaluation.ageFrom,
      ageTo: evaluation.ageTo,
      evaluatorTypes: evaluation.evaluatorTypes,
      dimensions: evaluation.dimensions.map((dimension) => ({
        id: dimension.id,
        name: dimension.name,
        code: dimension.code,
      })),
      questions: evaluation.questions.map((question) => ({
        id: question.id,
        content: question.content,
        order: question.order,
        dimension: {
          id: question.evaluationDimension.id,
          code: question.evaluationDimension.code,
          name: question.evaluationDimension.name,
        },
        answers: question.answers.map((answer) => ({
          id: answer.id,
          text: answer.text,
          code: answer.code,
          order: answer.order,
        })),
      })),
    }
  }

  async getAvailableEvaluationsForChild(childId: string, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [UserRole.PARENT])

    const parentProfile = await this.parentProfilesService.findByUserId(actor.userId)
    if (!parentProfile) throw ApiException.forbidden(ApiErrorCodes.USER_NOT_FOUND)

    // Try to find as private child first
    const privateChild = await this.privateChildrenRepository.findOne({
      where: { id: childId, parent: { id: parentProfile.id } },
      relations: { parent: true },
    })

    if (privateChild) {
      const age = this.calculateAge(privateChild.birthDate)
      const evaluations = await this.evalRepo
        .createQueryBuilder('evaluation')
        .where('evaluation.isArchived = false')
        .andWhere('(evaluation.ageFrom IS NULL OR evaluation.ageFrom <= :age)', {
          age,
        })
        .andWhere('(evaluation.ageTo IS NULL OR evaluation.ageTo >= :age)', {
          age,
        })
        .orderBy('evaluation.title', 'ASC')
        .getMany()

      return { childId, age, evaluations }
    }

    // Try organization child
    const orgChild = await this.organizationChildrenRepository.findOne({
      where: { id: childId, parent: { id: parentProfile.id } },
      relations: { parent: true, class: { organization: true } },
    })

    if (!orgChild) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    const age = this.calculateAge(orgChild.birthDate)

    const qb = this.evalRepo
      .createQueryBuilder('evaluation')
      .where('evaluation.isArchived = false')
      .andWhere('(evaluation.ageFrom IS NULL OR evaluation.ageFrom <= :age)', {
        age,
      })
      .andWhere('(evaluation.ageTo IS NULL OR evaluation.ageTo >= :age)', {
        age,
      })

    if (orgChild.class) {
      qb.andWhere(
        '(evaluation.institutionId = :institutionId OR evaluation.institutionId IS NULL)',
        {
          institutionId: orgChild.class.organization.id,
        },
      )
    }

    const evaluations = await qb.orderBy('evaluation.title', 'ASC').getMany()

    return { childId, age, evaluations }
  }

  startEvaluation(evaluationId: string, dto: StartEvaluationDto, actor: EvaluationActor) {
    return this.lifecycle.startEvaluation(evaluationId, dto, actor)
  }

  async saveProgress(attemptId: string, dto: SaveProgressDto, actor: EvaluationActor) {
    const scopedActor = await this.withParentProfileId(actor)
    await this.progress.saveProgress(attemptId, dto, scopedActor)
    return this.getAttempt(attemptId, scopedActor)
  }

  async submitAttempt(attemptId: string, dto: SubmitAttemptDto, actor: EvaluationActor) {
    return this.submissions.submitAttempt(attemptId, dto, await this.withParentProfileId(actor))
  }

  approveAttempt(attemptId: string, actor: EvaluationActor) {
    return this.approvals.approveAttempt(attemptId, actor)
  }

  async getAttempt(attemptId: string, actor: EvaluationActor) {
    const scopedActor = await this.withParentProfileId(actor)

    let attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: {
        answers: {
          selectedAnswer: true,
          evaluationDimension: true,
        },
        approval: true,
        evaluation: true,
        organizationChild: {
          class: {
            organization: {
              owner: true,
            },
            teacher: {
              user: true,
            },
          },
        },
        privateChild: true,
        parent: true,
      },
    })

    if (!attempt) throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)

    this.access.assertCanReadAttempt(attempt, scopedActor)

    if (scopedActor.roles.includes(UserRole.PARENT)) {
      await this.submissions.maybeAutoSubmitIfExpired(attemptId)
      attempt = await this.attemptRepo.findOne({
        where: { id: attemptId },
        relations: {
          answers: {
            selectedAnswer: true,
            evaluationDimension: true,
          },
          approval: true,
          evaluation: true,
          organizationChild: {
            class: {
              organization: {
                owner: true,
              },
              teacher: {
                user: true,
              },
            },
          },
          privateChild: true,
          parent: true,
        },
      })
      if (!attempt) throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
      this.access.assertCanReadAttempt(attempt, scopedActor)
    }

    return attempt
  }

  async getAttemptsForAdmin(
    actor: EvaluationActor,
    filters: {
      status?: EvaluationAttemptStatus
      evaluationId?: string
      childId?: string
      organizationChildId?: string
      privateChildId?: string
    },
    query?: PaginationQueryDto,
  ) {
    this.access.assertHasRole(actor, [UserRole.ADMIN])

    const where: any = {}

    if (filters.status) where.status = filters.status
    if (filters.evaluationId) where.evaluationId = filters.evaluationId
    if (filters.organizationChildId) {
      where.organizationChildId = filters.organizationChildId
    } else if (filters.childId) {
      where.organizationChildId = filters.childId
    }
    if (filters.privateChildId) where.privateChildId = filters.privateChildId

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20

    const [attempts, total] = await this.attemptRepo.findAndCount({
      where,
      relations: {
        organizationChild: true,
        privateChild: true,
        parent: true,
        evaluation: true,
        approval: true,
      },
      order: {
        startedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { data: attempts, meta: buildPaginationMeta(page, limit, total) }
  }

  async getAttemptsForChild(childId: string, actor: EvaluationActor, query?: PaginationQueryDto) {
    const isAdmin = actor.roles.includes(UserRole.ADMIN)
    const isParent = actor.roles.includes(UserRole.PARENT)

    if (!isAdmin && !isParent) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    const parentProfile = isParent
      ? await this.parentProfilesService.findByUserId(actor.userId)
      : null

    if (isParent && !parentProfile) throw ApiException.forbidden(ApiErrorCodes.USER_NOT_FOUND)

    const parentProfileId = isParent && parentProfile ? parentProfile.id : undefined

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20

    // Try private child first
    const privateChild = await this.privateChildrenRepository.findOne({
      where: isParent ? { id: childId, parent: { id: parentProfileId } } : { id: childId },
    })

    if (privateChild) {
      const attemptWhere: any = { privateChildId: childId }
      if (isParent) {
        attemptWhere.parentId = parentProfileId
      }

      const [attempts, total] = await this.attemptRepo.findAndCount({
        where: attemptWhere,
        relations: { evaluation: true, approval: true },
        order: { startedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      })

      return { data: attempts, meta: buildPaginationMeta(page, limit, total) }
    }

    // Try organization child
    const orgChild = await this.organizationChildrenRepository.findOne({
      where: isParent ? { id: childId, parent: { id: parentProfileId } } : { id: childId },
    })

    if (!orgChild) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    const attemptWhere: any = { organizationChildId: childId }
    if (isParent) {
      attemptWhere.parentId = parentProfileId
    }

    const [attempts, total] = await this.attemptRepo.findAndCount({
      where: attemptWhere,
      relations: { evaluation: true, approval: true },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { data: attempts, meta: buildPaginationMeta(page, limit, total) }
  }

  private calculateAge(birthDate: Date | string) {
    const birth = new Date(birthDate)
    const today = new Date()

    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }

    return age
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

  private async withParentProfileId(actor: EvaluationActor): Promise<EvaluationActor> {
    if (!actor.roles.includes(UserRole.PARENT) || actor.parentProfileId) {
      return actor
    }

    const parentProfile = await this.parentProfilesService.findByUserId(actor.userId)

    return {
      ...actor,
      parentProfileId: parentProfile.id,
    }
  }
}
