import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { Organization } from 'src/organizations/entities/organization.entity'
import { UserRole } from 'src/common/enums/role.enum'
import { hasRole } from 'src/common/utils/has-role.util'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { Teacher } from 'src/users/entities/teacher.entity'
import { User } from 'src/users/entities/user.entity'
import { Repository } from 'typeorm'
import { CreateDealDto } from './dto/create-deal.dto'
import { CreateProposalDto } from './dto/create-proposal.dto'
import { UpdateProposalDto } from './dto/update-proposal.dto'
import { RecordDealAttendanceDto, RejectProposalDto } from './dto/deal-lifecycle.dto'
import { DealStatus } from './enums/deal-status.enum'
import { ProposalStatus } from './enums/proposal-status.enum'
import { Activity } from './entities/activity.entity'
import { Deal } from './entities/deal.entity'
import { Proposal } from './entities/proposal.entity'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { DealAccessPolicy } from './policies/deal-access.policy'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { EnrichersService } from 'src/users/services/enrichers.service'

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(Proposal)
    private readonly proposalsRepo: Repository<Proposal>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationsRepo: Repository<Organization>,
    @InjectRepository(Teacher)
    private readonly teachersRepo: Repository<Teacher>,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditLoggingService,
    private readonly dealAccessPolicy: DealAccessPolicy,
    private readonly organizationsService: OrganizationsService,
    private readonly enrichersService: EnrichersService,
  ) {}

  async createDeal(dto: CreateDealDto, currentUser: JwtRequestUser) {
    const activity = await this.activitiesRepo.findOne({
      where: { id: dto.activityId },
    })
    if (!activity) {
      throw ApiException.notFound(ApiErrorCodes.ACTIVITY_NOT_FOUND)
    }

    const organizationId = await this.resolveOrganizationId(currentUser)
    await this.organizationsService.assertOrganizationApproved(organizationId)
    const organization = await this.organizationsRepo.findOne({
      where: { id: organizationId },
      relations: ['owner'],
    })
    if (!organization) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND)
    }

    const creator = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    })
    if (!creator) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    const deal = this.dealsRepo.create({
      activity,
      organization,
      creator,
      studentsCount: dto.studentsCount,
      deadline: new Date(dto.deadline),
      status: DealStatus.OPEN,
    })

    const savedDeal = await this.dealsRepo.save(deal)

    await this.auditService.logCreate(
      currentUser.userId,
      currentUser.email || '',
      currentUser.roles.map((r) => r.name).join(','),
      'Deal',
      savedDeal.id,
      {
        activityId: dto.activityId,
        studentsCount: dto.studentsCount,
        deadline: dto.deadline,
      },
      'Created deal',
    )

    await this.notifyServiceProviders(savedDeal.id)

    return savedDeal
  }

  async submitProposal(dealId: string, dto: CreateProposalDto, currentUser: JwtRequestUser) {
    await this.enrichersService.assertEnricherApproved(currentUser.userId)

    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    })
    if (!deal) {
      throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND)
    }

    this.ensureDealAcceptsBids(deal)

    const existing = await this.proposalsRepo.findOne({
      where: {
        deal: { id: dealId },
        provider: { id: currentUser.userId },
      },
    })
    if (existing) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DUPLICATE_PROPOSAL)
    }

    const provider = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    })
    if (!provider) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    const proposal = this.proposalsRepo.create({
      deal,
      provider,
      price: dto.price.toFixed(2),
      status: ProposalStatus.PENDING,
    })
    const saved = await this.proposalsRepo.save(proposal)

    if (deal.organization?.owner?.id) {
      await this.notificationsService.enqueue({
        userId: deal.organization.owner.id,
        title: 'New proposal received',
        message: `A new proposal has been submitted for deal ${deal.id}.`,
        delivery: NotificationDelivery.IN_APP,
      })
    }

    return saved
  }

  async updateProposal(proposalId: string, dto: UpdateProposalDto, currentUser: JwtRequestUser) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal', 'provider'],
    })
    if (!proposal) {
      throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND)
    }

    if (proposal.provider.id !== currentUser.userId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    if (new Date() >= proposal.deal.deadline) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DEADLINE_PASSED)
    }

    proposal.price = dto.price.toFixed(2)
    return this.proposalsRepo.save(proposal)
  }

  private ensureDealAcceptsBids(deal: Deal): void {
    if (deal.status !== DealStatus.OPEN) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_CLOSED)
    }

    if (new Date() >= new Date(deal.deadline)) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DEADLINE_PASSED)
    }
  }

  private async resolveOrganizationId(currentUser: JwtRequestUser) {
    const hasRole = (role: UserRole) => currentUser.roles.some((r) => r.name === role)

    if (hasRole(UserRole.ORGANIZATIONOWNER)) {
      const org = await this.organizationsRepo.findOne({
        where: { owner: { id: currentUser.userId } },
        select: ['id'],
      })
      if (!org) {
        throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND)
      }
      return org.id
    }

    if (hasRole(UserRole.TEACHER)) {
      const teacher = await this.teachersRepo.findOne({
        where: { user: { id: currentUser.userId } },
        relations: ['organization'],
      })
      if (!teacher?.organization?.id) {
        throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND)
      }
      return teacher.organization.id
    }

    throw ApiException.forbidden(ApiErrorCodes.DEAL_CANNOT_CREATE)
  }

  listDeals(status?: string) {
    const where = status ? { status: status as DealStatus } : {}
    return this.dealsRepo.find({ where, order: { createdAt: 'DESC' } })
  }

  findOne(id: string) {
    return this.dealsRepo.findOne({
      where: { id },
      relations: ['organization', 'activity', 'creator'],
    })
  }

  listMyProposals(userId: string) {
    return this.proposalsRepo.find({
      where: { provider: { id: userId } },
      relations: ['deal', 'deal.organization'],
      order: { createdAt: 'DESC' },
    })
  }

  async selectProposal(proposalId: string, currentUser: JwtRequestUser) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal', 'deal.organization', 'deal.organization.owner'],
    })
    if (!proposal) throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND)

    const orgId = await this.resolveOrganizationId(currentUser)
    if (proposal.deal.organization.id !== orgId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    proposal.status = ProposalStatus.SELECTED
    proposal.deal.status = DealStatus.AWARDED

    await this.proposalsRepo.save(proposal)
    await this.dealsRepo.save(proposal.deal)

    return proposal
  }

  async getProposalsForDeal(dealId: string, currentUser: JwtRequestUser) {
    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    })
    if (!deal) throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND)

    if (!hasRole(currentUser.roles, UserRole.ADMIN)) {
      const orgId = await this.resolveOrganizationId(currentUser)
      if (deal.organization.id !== orgId) {
        throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
      }
    }

    return this.proposalsRepo.find({
      where: { deal: { id: dealId } },
      relations: ['provider'],
      order: { createdAt: 'DESC' },
    })
  }

  async adminApproveProposal(proposalId: string, currentUser: JwtRequestUser) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal', 'deal.organization', 'deal.organization.owner', 'provider'],
    })
    if (!proposal) throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND)
    if (proposal.status !== ProposalStatus.SELECTED) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_PROPOSAL_INVALID_STATE)
    }

    proposal.status = ProposalStatus.APPROVED
    proposal.deal.status = DealStatus.EXECUTING
    await this.proposalsRepo.save(proposal)
    await this.dealsRepo.save(proposal.deal)

    await this.auditService.logApprove(
      currentUser.userId,
      currentUser.email || '',
      currentUser.roles.map((r) => r.name).join(','),
      'Proposal',
      proposal.id,
      'Admin approved selected deal proposal',
    )

    if (proposal.provider?.id) {
      await this.notificationsService.enqueue({
        userId: proposal.provider.id,
        title: 'Proposal approved',
        message: `Your proposal for deal ${proposal.deal.id} was approved. Activity execution can begin.`,
        delivery: NotificationDelivery.IN_APP,
      })
    }

    if (proposal.deal.organization?.owner?.id) {
      await this.notificationsService.enqueue({
        userId: proposal.deal.organization.owner.id,
        title: 'Deal proposal approved',
        message: `Admin approved the selected provider for your deal. Record attendance when the activity completes.`,
        delivery: NotificationDelivery.IN_APP,
      })
    }

    return proposal
  }

  async adminRejectProposal(
    proposalId: string,
    dto: RejectProposalDto,
    currentUser: JwtRequestUser,
  ) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal', 'deal.organization', 'deal.organization.owner', 'provider'],
    })
    if (!proposal) throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND)
    if (proposal.status !== ProposalStatus.SELECTED) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_PROPOSAL_INVALID_STATE)
    }

    proposal.status = ProposalStatus.REJECTED
    proposal.deal.status = DealStatus.OPEN
    await this.proposalsRepo.save(proposal)
    await this.dealsRepo.save(proposal.deal)

    await this.auditService.logReject(
      currentUser.userId,
      currentUser.email || '',
      currentUser.roles.map((r) => r.name).join(','),
      'Proposal',
      proposal.id,
      dto.reason ?? 'Admin rejected selected deal proposal',
    )

    if (proposal.provider?.id) {
      await this.notificationsService.enqueue({
        userId: proposal.provider.id,
        title: 'Proposal rejected',
        message: dto.reason
          ? `Your selected proposal was rejected: ${dto.reason}`
          : 'Your selected proposal was rejected by an administrator.',
        delivery: NotificationDelivery.IN_APP,
      })
    }

    return proposal
  }

  async recordDealAttendance(
    dealId: string,
    dto: RecordDealAttendanceDto,
    currentUser: JwtRequestUser,
  ) {
    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    })
    if (!deal) throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND)

    this.assertDealLifecycleAccess(deal, currentUser)

    if (deal.status !== DealStatus.EXECUTING) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_INVALID_STATE)
    }

    if (dto.studentsAttended > deal.studentsCount) {
      throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED, {
        field: 'studentsAttended',
      })
    }

    deal.studentsAttended = dto.studentsAttended
    deal.attendanceNotes = dto.notes ?? null
    deal.attendanceRecordedAt = new Date()
    const saved = await this.dealsRepo.save(deal)

    await this.auditService.logUpdate(
      currentUser.userId,
      currentUser.email || '',
      currentUser.roles.map((r) => r.name).join(','),
      'Deal',
      deal.id,
      { studentsAttended: null, attendanceRecordedAt: null },
      {
        studentsAttended: dto.studentsAttended,
        attendanceRecordedAt: saved.attendanceRecordedAt,
      },
      'Recorded deal attendance',
    )

    return saved
  }

  async closeDeal(dealId: string, currentUser: JwtRequestUser) {
    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    })
    if (!deal) throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND)

    this.assertDealLifecycleAccess(deal, currentUser)

    if (deal.status !== DealStatus.EXECUTING) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_INVALID_STATE)
    }

    if (deal.studentsAttended == null || deal.attendanceRecordedAt == null) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_ATTENDANCE_REQUIRED)
    }

    const oldStatus = deal.status
    deal.status = DealStatus.CLOSED
    deal.closedAt = new Date()
    const saved = await this.dealsRepo.save(deal)

    await this.auditService.logUpdate(
      currentUser.userId,
      currentUser.email || '',
      currentUser.roles.map((r) => r.name).join(','),
      'Deal',
      deal.id,
      { status: oldStatus },
      { status: DealStatus.CLOSED, closedAt: saved.closedAt },
      'Closed deal after execution',
    )

    return saved
  }

  private assertDealLifecycleAccess(
    deal: Deal,
    currentUser: JwtRequestUser,
  ): void {
    if (hasRole(currentUser.roles, UserRole.ADMIN)) return

    if (deal.organization?.owner?.id === currentUser.userId) return

    throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
  }

  private async notifyServiceProviders(dealId: string): Promise<void> {
    const providers = await this.usersRepo.find()
    const providerUsers = providers.filter((u) =>
      u.roles.some((role) => role.name === UserRole.ENRICHER),
    )

    await Promise.all(
      providerUsers.map((provider) =>
        this.notificationsService.enqueue({
          userId: provider.id,
          title: 'New deal available',
          message: `A new deal is available for bidding (deal id: ${dealId}).`,
          delivery: NotificationDelivery.IN_APP,
        }),
      ),
    )
  }
}
