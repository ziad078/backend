import { Injectable } from '@nestjs/common'
import { Actor, Policy, PolicyResult } from 'src/common/policies/base-policy.interface'
import { Deal } from '../entities/deal.entity'
import { Proposal } from '../entities/proposal.entity'
import { UserRole } from 'src/common/enums/role.enum'

@Injectable()
export class DealAccessPolicy implements Policy<Deal> {
  canView(actor: Actor, resource: Deal): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) ||
      actor.roles.includes(UserRole.TEACHER)
    ) {
      if (resource.organization.ownerId === actor.userId || resource.creator?.id === actor.userId) {
        return { allowed: true }
      }
    }

    if (actor.roles.includes(UserRole.ENRICHER)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Insufficient permissions' }
  }

  canCreate(actor: Actor, resource?: Partial<Deal>): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) ||
      actor.roles.includes(UserRole.TEACHER)
    ) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Only organization owner or teacher can create deals' }
  }

  canUpdate(actor: Actor, resource: Deal): PolicyResult {
    return this.canCreate(actor)
  }

  canDelete(actor: Actor, resource: Deal): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (resource.organization.ownerId === actor.userId) {
        return { allowed: true }
      }
    }

    return { allowed: false, reason: 'Only admin or organization owner can delete deals' }
  }

  canViewProposals(actor: Actor, deal: Deal): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (deal.organization.ownerId === actor.userId) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: 'Organization owner can only view proposals for their deals',
      }
    }

    return { allowed: false, reason: 'Only admin or organization owner can view proposals' }
  }

  canSelectProposal(actor: Actor, deal: Deal, proposal: Proposal): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      return { allowed: true }
    }

    if (actor.roles.includes(UserRole.ORGANIZATIONOWNER)) {
      if (deal.organization.ownerId !== actor.userId) {
        return {
          allowed: false,
          reason: 'Organization owner can only select proposals for their deals',
        }
      }

      if (deal.status !== 'OPEN') {
        return { allowed: false, reason: 'Can only select proposal for open deals' }
      }

      if (proposal.status !== 'PENDING') {
        return { allowed: false, reason: 'Can only select pending proposals' }
      }

      const existingSelected = deal.proposals.some((p) => p.status === 'SELECTED')
      if (existingSelected) {
        return { allowed: false, reason: 'A proposal has already been selected' }
      }

      return { allowed: true }
    }

    return { allowed: false, reason: 'Only organization owner can select proposals' }
  }

  canApproveProposal(actor: Actor, proposal: Proposal): PolicyResult {
    if (actor.roles.includes(UserRole.ADMIN)) {
      if (proposal.status !== 'SELECTED') {
        return { allowed: false, reason: 'Can only approve selected proposals' }
      }
      return { allowed: true }
    }

    return { allowed: false, reason: 'Only admin can approve proposals' }
  }

  canSubmitProposal(actor: Actor, deal: Deal): PolicyResult {
    if (actor.roles.includes(UserRole.ENRICHER)) {
      if (deal.status !== 'OPEN') {
        return { allowed: false, reason: 'Can only submit proposals for open deals' }
      }

      const now = new Date()
      if (deal.deadline && now > new Date(deal.deadline)) {
        return { allowed: false, reason: 'Cannot submit proposal after deadline' }
      }

      return { allowed: true }
    }

    return { allowed: false, reason: 'Only enricher can submit proposals' }
  }
}
