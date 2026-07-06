import { Injectable } from '@nestjs/common'
import { Actor, Policy, PolicyResult } from 'src/common/policies/base-policy.interface'
import { OrganizationChild } from '../entities/organization-child.entity'
import { PrivateChild } from '../entities/private-child.entity'
import { UserRole } from 'src/common/enums/role.enum'

export type Child = OrganizationChild | PrivateChild

@Injectable()
export class ChildAccessPolicy implements Policy<Child> {
  canView(actor: Actor, resource: Child): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT)) {
      if (this.isParentOfChild(actor, resource)) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: 'Parent can only view their own children',
      }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (this.isOrganizationChild(resource)) {
        if (resource.organization.ownerId === actor.userId) {
          return { allowed: true }
        }
        return {
          allowed: false,
          reason: 'Organization owner can only view their organization children',
        }
      }
      return {
        allowed: false,
        reason: 'Organization owner cannot view private children',
      }
    }

    if (actor.roles.includes(UserRole.TEACHER)) {
      if (this.isOrganizationChild(resource)) {
        if (resource.class.teacher?.user?.id === actor.userId) {
          return { allowed: true }
        }
        if (resource.organization.ownerId === actor.userId) {
          return { allowed: true }
        }
        return {
          allowed: false,
          reason: 'Teacher can only view children in their class or organization',
        }
      }
      return { allowed: false, reason: 'Teacher cannot view private children' }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canCreate(actor: Actor): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) ||
      actor.roles.includes(UserRole.TEACHER)
    ) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canUpdate(actor: Actor, resource: Child): PolicyResult {
    return this.canView(actor, resource)
  }

  canDelete(actor: Actor, resource: Child): PolicyResult {
    return this.canView(actor, resource)
  }

  canListOrganizationChildren(actor: Actor): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.TEACHER)) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: 'Only organization members can list organization children',
    }
  }

  canListPrivateChildren(actor: Actor, parentUserId: string): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.PARENT) && actor.userId === parentUserId) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: 'Parent can only list their own private children',
    }
  }

  private isParentOfChild(actor: Actor, resource: Child): boolean {
    return resource.parent.userId === actor.userId
  }

  private isOrganizationChild(resource: Child): resource is OrganizationChild {
    return 'organizationId' in resource && resource.organizationId !== null
  }

  private isPrivateChild(resource: Child): resource is PrivateChild {
    return 'organizationId' in resource && resource.organizationId === undefined
  }
}
