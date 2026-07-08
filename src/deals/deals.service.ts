import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { Organization } from 'src/organizations/entities/organization.entity'
import { UserRole } from 'src/common/enums/role.enum'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { Teacher } from 'src/users/entities/teacher.entity'
import { User } from 'src/users/entities/user.entity'
import { Repository } from 'typeorm'
import { CreateDealDto } from './dto/create-deal.dto'
import { CreateProposalDto } from './dto/create-proposal.dto'
import { UpdateProposalDto } from './dto/update-proposal.dto'
import { DealStatus } from './enums/deal-status.enum'
import { ProposalStatus } from './enums/proposal-status.enum'
import { Activity } from './entities/activity.entity'
import { Deal } from './entities/deal.entity'
import { Proposal } from './entities/proposal.entity'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { DealAccessPolicy } from './policies/deal-access.policy'

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
  ) {}

  async createDeal(dto: CreateDealDto, currentUser: JwtRequestUser) {
    const activity = await this.activitiesRepo.findOne({
      where: { id: dto.activityId },
    })
    if (!activity) {
      throw ApiException.notFound(ApiErrorCodes.ACTIVITY_NOT_FOUND, 'Activity not found')
    }

    const organizationId = await this.resolveOrganizationId(currentUser)
    const organization = await this.organizationsRepo.findOne({
      where: { id: organizationId },
      relations: ['owner'],
    })
    if (!organization) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found')
    }

    const creator = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    })
    if (!creator) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND, 'User not found')
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
    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    })
    if (!deal) {
      throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND, 'Deal not found')
    }

    this.ensureDealAcceptsBids(deal)

    const existing = await this.proposalsRepo.findOne({
      where: {
        deal: { id: dealId },
        provider: { id: currentUser.userId },
      },
    })
    if (existing) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DUPLICATE_PROPOSAL, 'You have already submitted a proposal for this deal')
    }

    const provider = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    })
    if (!provider) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND, 'User not found')
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
      throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND, 'Proposal not found')
    }

    if (proposal.provider.id !== currentUser.userId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You can only update your own proposal')
    }

    if (new Date() >= proposal.deal.deadline) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DEADLINE_PASSED, 'Cannot update proposal after deal deadline')
    }

    proposal.price = dto.price.toFixed(2)
    return this.proposalsRepo.save(proposal)
  }

  private ensureDealAcceptsBids(deal: Deal): void {
    if (deal.status !== DealStatus.OPEN) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_CLOSED, 'This deal is closed')
    }

    if (new Date() >= new Date(deal.deadline)) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_DEADLINE_PASSED, 'Deal deadline has passed')
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
        throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found for owner')
      }
      return org.id
    }

    if (hasRole(UserRole.TEACHER)) {
      const teacher = await this.teachersRepo.findOne({
        where: { user: { id: currentUser.userId } },
        relations: ['organization'],
      })
      if (!teacher?.organization?.id) {
        throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found for teacher')
      }
      return teacher.organization.id
    }

    throw ApiException.forbidden(ApiErrorCodes.DEAL_CANNOT_CREATE, 'You are not allowed to create deals')
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
    if (!proposal) throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND, 'Proposal not found')

    const orgId = await this.resolveOrganizationId(currentUser)
    if (proposal.deal.organization.id !== orgId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You can only manage your own organization deals')
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
    if (!deal) throw ApiException.notFound(ApiErrorCodes.DEAL_NOT_FOUND, 'Deal not found')

    const orgId = await this.resolveOrganizationId(currentUser)
    if (deal.organization.id !== orgId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You can only view proposals for your own deals')
    }

    return this.proposalsRepo.find({
      where: { deal: { id: dealId } },
      relations: ['provider'],
      order: { createdAt: 'DESC' },
    })
  }

  async adminApproveProposal(proposalId: string) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal'],
    })
    if (!proposal) throw ApiException.notFound(ApiErrorCodes.DEAL_PROPOSAL_NOT_FOUND, 'Proposal not found')
    if (proposal.status !== ProposalStatus.SELECTED) {
      throw ApiException.badRequest(ApiErrorCodes.DEAL_PROPOSAL_INVALID_STATE, 'Only selected proposals can be approved')
    }

    proposal.status = ProposalStatus.APPROVED
    return this.proposalsRepo.save(proposal)
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
