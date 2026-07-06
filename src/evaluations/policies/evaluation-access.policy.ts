import { Injectable } from '@nestjs/common'
import { Actor, Policy, PolicyResult } from 'src/common/policies/base-policy.interface'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { Evaluation } from '../entities/evaluation.entity'
import { UserRole } from 'src/common/enums/role.enum'

@Injectable()
export class EvaluationAccessPolicy implements Policy<Evaluation> {
  canView(actor: Actor, resource: Evaluation): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canCreate(actor: Actor, resource?: Partial<Evaluation>): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Only admin can create evaluations' }
  }

  canUpdate(actor: Actor, resource: Evaluation): PolicyResult {
    return this.canCreate(actor)
  }

  canDelete(actor: Actor, resource: Evaluation): PolicyResult {
    return this.canCreate(actor)
  }

  canStartAttempt(actor: Actor, attempt: EvaluationAttempt): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT)) {
      if (attempt.parent.userId !== actor.userId) {
        return { allowed: false, reason: 'Parent can only start attempts for their own children' }
      }

      if (attempt.privateChildId) {
        return { allowed: true }
      }

      if (attempt.organizationChildId) {
        return { allowed: false, reason: 'Parent cannot start organization evaluation attempts' }
      }

      return { allowed: true }
    }

    return { allowed: false, reason: 'Only parent can start evaluation attempts' }
  }

  canViewAttempt(actor: Actor, attempt: EvaluationAttempt): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT)) {
      if (attempt.parent.userId !== actor.userId) {
        return { allowed: false, reason: 'Parent can only view their own attempts' }
      }
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (attempt.privateChildId) {
        return { allowed: false, reason: 'Organization owner cannot view private child attempts' }
      }

      if (attempt.organizationChild) {
        if (attempt.organizationChild.organization.ownerId === actor.userId) {
          return { allowed: true }
        }
        return {
          allowed: false,
          reason: 'Organization owner can only view their organization child attempts',
        }
      }

      return {
        allowed: false,
        reason: 'Organization owner can only view organization child attempts',
      }
    }

    if (actor.roles.includes(UserRole.TEACHER)) {
      if (attempt.privateChildId) {
        return { allowed: false, reason: 'Teacher cannot view private child attempts' }
      }

      if (attempt.organizationChild) {
        if (attempt.organizationChild.class.teacher?.user?.id === actor.userId) {
          return { allowed: true }
        }
        if (attempt.organizationChild.organization.ownerId === actor.userId) {
          return { allowed: true }
        }
        return {
          allowed: false,
          reason: 'Teacher can only view attempts for children in their class or organization',
        }
      }

      return { allowed: false, reason: 'Teacher can only view organization child attempts' }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canApproveAttempt(actor: Actor, attempt: EvaluationAttempt): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Only admin can approve evaluation attempts' }
  }
}
