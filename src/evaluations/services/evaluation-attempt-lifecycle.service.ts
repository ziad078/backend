import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { InjectRepository } from '@nestjs/typeorm'
import { EventEmitter2 } from 'eventemitter2'
import { DataSource, Repository } from 'typeorm'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { UserRole } from 'src/common/enums/role.enum'
import { StartEvaluationDto } from '../dto/start-evaluation.dto'
import { Evaluation } from '../entities/evaluation.entity'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'
import { EVALUATION_EVENTS } from '../evaluations.events'
import { EvaluationAccessPolicy, EvaluationActor } from './evaluation-access-policy.service'
import { EvaluationSlotService } from './evaluation-slot.service'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'
@Injectable()
export class EvaluationAttemptLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly access: EvaluationAccessPolicy,
    private readonly slots: EvaluationSlotService,
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(OrganizationChild)
    private readonly organizationChildren: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private readonly privateChildren: Repository<PrivateChild>,
    private readonly parentProfilesService: ParentProfilesService,
  ) {}

  async startEvaluation(evaluationId: string, dto: StartEvaluationDto, actor: EvaluationActor) {
    this.access.assertHasRole(actor, [
      UserRole.PARENT,
      UserRole.TEACHER,
      UserRole.ORGANIZATIONOWNER,
      UserRole.ADMIN,
    ])

    const evaluation = await this.evaluations.findOne({
      where: { id: evaluationId },
    })

    if (!evaluation) {
      throw ApiException.notFound(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    // Staff roles (teacher / org owner / admin) may not have a parent profile;
    // use the non-throwing lookup so we can fall back to org-child staff access.
    const parentProfile = await this.parentProfilesService.findByUserIdOrNull(actor.userId)

    let child: OrganizationChild | PrivateChild
    let isPrivateChild: boolean

    const privateChild =
      parentProfile != null
        ? await this.privateChildren.findOne({
            where: { id: dto.childId, parent: { id: parentProfile.id } },
            relations: { parent: true },
          })
        : null

    if (privateChild) {
      child = privateChild
      isPrivateChild = true
    } else {
      const orgChild = await this.organizationChildren.findOne({
        where: { id: dto.childId },
        relations: {
          parent: true,
          class: { organization: { owner: true }, teacher: { user: true } },
        },
      })

      if (!orgChild) {
        throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
      }

      if (parentProfile && orgChild.parent.id === parentProfile.id) {
        child = orgChild
        isPrivateChild = false
      } else if (
        actor.roles.includes(UserRole.TEACHER) ||
        actor.roles.includes(UserRole.ORGANIZATIONOWNER) ||
        actor.roles.includes(UserRole.ADMIN)
      ) {
        this.access.assertOrgChildStaffAccess(orgChild, actor)
        child = orgChild
        isPrivateChild = false
      } else {
        throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
      }
    }

    const attemptParentProfile = isPrivateChild
      ? (child as PrivateChild).parent
      : (child as OrganizationChild).parent

    if (
      !isPrivateChild &&
      evaluation.institutionId != null &&
      evaluation.institutionId !== (child as OrganizationChild).class?.organization?.id
    ) {
      throw ApiException.forbidden(ApiErrorCodes.EVALUATION_NOT_FOUND)
    }

    const age = this.calculateAge(child.birthDate)
    if (
      (evaluation.ageFrom != null && age < evaluation.ageFrom) ||
      (evaluation.ageTo != null && age > evaluation.ageTo)
    ) {
      throw ApiException.forbidden(ApiErrorCodes.EVALUATION_NOT_SUITABLE_AGE)
    }

    const expiresAt = this.resolveExpiresAt(dto)
    let limitReachedPayload: {
      evaluationId: string
      parentId: string
      childId: string
      attempts: number
      reason: string
    } | null = null

    const attempt = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationAttempt)

      const whereClause: Record<string, unknown> = {
        evaluationId,
        parentId: attemptParentProfile.id,
      }

      if (isPrivateChild) {
        whereClause.privateChildId = dto.childId
      } else {
        whereClause.organizationChildId = dto.childId
      }

      const attempts = await repo.find({
        where: whereClause,
        order: { attemptNumber: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      })

      const inProgress = attempts.some(
        (attemptRow) => attemptRow.status === EvaluationAttemptStatus.IN_PROGRESS,
      )

      if (inProgress) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      const count = attempts.length

      let entitlementId: string | null = null

      if (isPrivateChild) {
        // Private children: slot entitlements govern the full lifecycle — the
        // 2 free attempts (MAIN + RETAKE) and any paid EXTRA attempts. A READY,
        // unconsumed slot must exist; the slot system already enforces the
        // "2 free, then request -> pay -> unlock" policy.
        const entitlement = await this.slots.findEntitlementForNext(
          manager,
          dto.childId,
          attemptParentProfile.id,
        )

        if (!entitlement) {
          throw ApiException.badRequest(ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND)
        }

        entitlementId = entitlement.id
      } else if (count >= 2) {
        // Organization children: exactly 2 free attempts per evaluation.
        limitReachedPayload = {
          evaluationId,
          parentId: attemptParentProfile.id,
          childId: dto.childId,
          attempts: count,
          reason: 'max_attempts',
        }
        throw ApiException.conflict(ApiErrorCodes.EVALUATION_MAX_ATTEMPTS)
      }

      const createData: Record<string, unknown> = {
        evaluationId,
        parentId: attemptParentProfile.id,
        attemptNumber: count + 1,
        status: EvaluationAttemptStatus.IN_PROGRESS,
        expiresAt,
        score: null,
        result: null,
        submittedAt: null,
      }

      if (isPrivateChild) {
        createData.privateChildId = dto.childId
      } else {
        createData.organizationChildId = dto.childId
      }

      const saved = (await repo.save(repo.create(createData))) as unknown as EvaluationAttempt

      if (isPrivateChild && entitlementId) {
        await this.slots.linkEvaluationToEntitlement(manager, entitlementId, saved.id)
      }

      return saved
    })

    if (limitReachedPayload) {
      this.events.emit(EVALUATION_EVENTS.limitReached, limitReachedPayload)
    }

    return attempt
  }

  private resolveExpiresAt(dto: StartEvaluationDto): Date | null {
    if (dto.expiresAt && dto.expiresInSeconds) {
      throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
    }

    if (dto.expiresAt) {
      const d = new Date(dto.expiresAt)

      if (Number.isNaN(d.getTime())) {
        throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
      }

      if (d.getTime() <= Date.now()) {
        throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
      }

      return d
    }

    if (dto.expiresInSeconds) {
      return new Date(Date.now() + dto.expiresInSeconds * 1000)
    }

    return null
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
}
