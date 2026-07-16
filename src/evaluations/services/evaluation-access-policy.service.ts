import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { UserRole } from 'src/common/enums/role.enum'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { resolveChild } from 'src/common/helpers/child-resolver.helper'

export type EvaluationActor = {
  userId: string
  roles: UserRole[]
  parentProfileId?: string
}

@Injectable()
export class EvaluationAccessPolicy {
  assertHasRole(actor: EvaluationActor, allowed: UserRole[]) {
    if (!actor.roles.some((role) => allowed.includes(role))) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }
  }

  assertParentOwnership(attempt: EvaluationAttempt, actor: EvaluationActor) {
    if (actor.parentProfileId) {
      if (attempt.parentId !== actor.parentProfileId) {
        throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
      }
      return
    }

    if (!attempt.parent || attempt.parent.userId !== actor.userId) {
      throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
    }
  }

  assertCanReadAttempt(attempt: EvaluationAttempt, actor: EvaluationActor) {
    if (actor.roles.includes(UserRole.ADMIN)) return

    if (actor.roles.includes(UserRole.PARENT)) {
      this.assertParentOwnership(attempt, actor)
      return
    }

    const child = resolveChild(attempt)
    const childClass = child && 'class' in child ? child.class : undefined

    if (!childClass) {
      throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) &&
      childClass.organization?.owner?.id === actor.userId
    ) {
      return
    }

    if (actor.roles.includes(UserRole.TEACHER) && childClass.teacher?.user?.id === actor.userId) {
      return
    }

    throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
  }

  assertOrgChildStaffAccess(orgChild: OrganizationChild, actor: EvaluationActor) {
    if (actor.roles.includes(UserRole.ADMIN)) return

    const orgOwnerId = orgChild.class?.organization?.owner?.id
    const teacherUserId = orgChild.class?.teacher?.user?.id

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER) && orgOwnerId === actor.userId) {
      return
    }

    if (actor.roles.includes(UserRole.TEACHER) && teacherUserId === actor.userId) {
      return
    }

    throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
  }

  assertCanWriteAttempt(attempt: EvaluationAttempt, actor: EvaluationActor) {
    if (actor.roles.includes(UserRole.ADMIN)) return

    if (actor.roles.includes(UserRole.PARENT)) {
      this.assertParentOwnership(attempt, actor)
      return
    }

    const child = resolveChild(attempt)
    const childClass = child && 'class' in child ? child.class : undefined

    if (!childClass) {
      throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) &&
      childClass.organization?.owner?.id === actor.userId
    ) {
      return
    }

    if (actor.roles.includes(UserRole.TEACHER) && childClass.teacher?.user?.id === actor.userId) {
      return
    }

    throw ApiException.forbidden(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
  }
}
