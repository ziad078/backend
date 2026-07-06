import { Injectable } from '@nestjs/common'
import { Actor, Policy, PolicyResult } from 'src/common/policies/base-policy.interface'
import { TransferRequest } from '../entities/transfer-request.entity'
import { UserRole } from 'src/common/enums/role.enum'

@Injectable()
export class TransferAccessPolicy implements Policy<TransferRequest> {
  canView(actor: Actor, resource: TransferRequest): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (
        resource.fromOrganization?.ownerId === actor.userId ||
        resource.toOrganization?.ownerId === actor.userId
      ) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: 'Organization owner can only view transfer requests involving their organization',
      }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canCreate(actor: Actor, resource?: Partial<TransferRequest>): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: 'Only admin or organization owner can create transfer requests',
    }
  }

  canUpdate(actor: Actor, resource: TransferRequest): PolicyResult {
    return this.canCreate(actor)
  }

  canDelete(actor: Actor, resource: TransferRequest): PolicyResult {
    return this.canCreate(actor)
  }

  canApprove(actor: Actor, resource: TransferRequest): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (resource.toOrganization.ownerId !== actor.userId) {
        return {
          allowed: false,
          reason: 'Organization owner can only approve transfer requests to their organization',
        }
      }

      if (resource.status !== 'PENDING') {
        return { allowed: false, reason: 'Can only approve pending transfer requests' }
      }

      return { allowed: true }
    }

    return {
      allowed: false,
      reason: 'Only admin or target organization owner can approve transfer requests',
    }
  }

  canReject(actor: Actor, resource: TransferRequest): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (
        resource.fromOrganization.ownerId === actor.userId ||
        resource.toOrganization.ownerId === actor.userId
      ) {
        if (resource.status !== 'PENDING') {
          return { allowed: false, reason: 'Can only reject pending transfer requests' }
        }
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: 'Organization owner can only reject transfer requests involving their organization',
      }
    }

    return {
      allowed: false,
      reason: 'Only admin or involved organization owner can reject transfer requests',
    }
  }
}
