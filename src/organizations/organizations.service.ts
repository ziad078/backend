import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { UpdateOrganizationDto } from './dto/update-organization.dto'
import { Organization } from './entities/organization.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationResponseDto } from './dto/organization-response.dto'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { UserRole } from 'src/common/enums/role.enum'
import { hasRole } from 'src/common/utils/has-role.util'
import EventEmitter2 from 'eventemitter2'
import { OrganizationEvents } from './enums/organization-events.enum'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto'
import { buildPaginationMeta } from 'src/common/dto/pagination-query.dto'
import { Brackets } from 'typeorm'

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(ParentProfile)
    private parentProfileRepository: Repository<ParentProfile>,
    private readonly events: EventEmitter2,
  ) {}

  listForAdmin(query: ListOrganizationsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const qb = this.organizationRepository
      .createQueryBuilder('org')
      .leftJoinAndSelect('org.owner', 'owner')
      .orderBy('org.organizationName', 'ASC')

    if (query.status) {
      qb.andWhere('org.approvalStatus = :status', { status: query.status })
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('org.organizationName ILIKE :term', { term })
            .orWhere('owner.name ILIKE :term', { term })
            .orWhere('owner.email ILIKE :term', { term })
            .orWhere('CAST(org.id AS text) ILIKE :term', { term })
        }),
      )
    }

    return qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([orgs, total]) => ({
        data: orgs.map(OrganizationResponseDto.fromEntity),
        meta: buildPaginationMeta(page, limit, total),
      }))
  }

  findAll(status?: ApprovalStatus) {
    return this.listForAdmin({ status, page: 1, limit: 1000 })
  }

  findPending() {
    return this.listForAdmin({ status: ApprovalStatus.PENDING, page: 1, limit: 1000 })
  }

  async findOne(id: string) {
    const org = await this.findOneOrFail(id)
    return OrganizationResponseDto.fromEntity(org)
  }

  async findOneOrFail(id: string, relations: string[] = []): Promise<Organization> {
    const org = await this.organizationRepository.findOne({
      where: { id },
      relations,
    })
    if (!org) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, { id })
    }
    return org
  }

  async assertOrganizationApproved(organizationId: string): Promise<Organization> {
    const org = await this.findOneOrFail(organizationId)
    if (org.approvalStatus !== ApprovalStatus.APPROVED) {
      throw ApiException.forbidden(ApiErrorCodes.ORGANIZATION_NOT_APPROVED)
    }
    return org
  }

  async findByParent(id: string) {
    const orgs = await this.organizationRepository
      .createQueryBuilder('org')
      .leftJoin('parent_organizations', 'link', 'link.organizationId = org.id')
      .leftJoin('organization_children', 'child', 'child.organizationId = org.id')
      .where('link.parentId = :parentId', { parentId: id })
      .orWhere('child.parentId = :parentId', { parentId: id })
      .distinct(true)
      .getMany()

    return orgs.map(OrganizationResponseDto.fromEntity)
  }

  async findByOwner(ownerId: string) {
    const org = await this.organizationRepository.findOne({
      where: { owner: { id: ownerId } },
    })
    if (!org) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, { ownerId })
    }
    return org
  }

  async findByOwnerResponse(ownerId: string) {
    const org = await this.findByOwner(ownerId)
    return OrganizationResponseDto.fromEntity(org)
  }

  assertCanAccessOrganization(org: Organization, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return
    if (org.ownerId === actor.userId) return
    throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
  }

  async assertParentProfileAccess(parentProfileId: string, userId: string): Promise<void> {
    const profile = await this.parentProfileRepository.findOne({
      where: { id: parentProfileId },
      select: ['id', 'userId'],
    })

    if (!profile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND, { parentProfileId })
    }

    if (profile.userId !== userId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }
  }

  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
      relations: ['owner', 'teachers', 'teachers.user'],
    })

    if (!org) {
      return false
    }

    if (org.owner?.id === userId) {
      return true
    }

    const isTeacher = org.teachers?.some((teacher) => teacher.user?.id === userId)

    return !!isTeacher
  }

  async approve(id: string, adminId: string): Promise<OrganizationResponseDto> {
    const org = await this.findOneOrFail(id, ['owner'])

    if (org.approvalStatus === ApprovalStatus.APPROVED) {
      throw ApiException.conflict(ApiErrorCodes.ORGANIZATION_ALREADY_APPROVED)
    }

    org.approvalStatus = ApprovalStatus.APPROVED
    org.approvedById = adminId
    org.approvedAt = new Date()
    org.rejectedById = null
    org.rejectedAt = null
    org.rejectionReason = null

    const saved = await this.organizationRepository.save(org)
    this.events.emit(OrganizationEvents.APPROVED, {
      orgId: saved.id,
      ownerName: org.owner?.name ?? '',
      orgName: saved.organizationName,
      ownerId: saved.ownerId,
    })

    return OrganizationResponseDto.fromEntity(saved)
  }

  async reject(
    id: string,
    adminId: string,
    rejectionReason: string,
  ): Promise<OrganizationResponseDto> {
    const org = await this.findOneOrFail(id, ['owner'])

    if (org.approvalStatus === ApprovalStatus.REJECTED) {
      throw ApiException.conflict(ApiErrorCodes.ORGANIZATION_ALREADY_REJECTED)
    }

    org.approvalStatus = ApprovalStatus.REJECTED
    org.rejectedById = adminId
    org.rejectedAt = new Date()
    org.rejectionReason = rejectionReason
    org.approvedById = null
    org.approvedAt = null

    const saved = await this.organizationRepository.save(org)
    this.events.emit(OrganizationEvents.REJECTED, {
      orgId: saved.id,
      ownerName: org.owner?.name ?? '',
      orgName: saved.organizationName,
      ownerId: saved.ownerId,
      rejectionReason: saved.rejectionReason ?? rejectionReason,
    })
    return OrganizationResponseDto.fromEntity(saved)
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto, actor: JwtRequestUser) {
    const hasUpdates =
      updateOrganizationDto.organizationName !== undefined ||
      updateOrganizationDto.organizationType !== undefined

    if (!hasUpdates) {
      throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
    }

    const org = await this.findOneOrFail(id)
    this.assertCanAccessOrganization(org, actor)

    if (updateOrganizationDto.organizationName !== undefined) {
      org.organizationName = updateOrganizationDto.organizationName
    }
    if (updateOrganizationDto.organizationType !== undefined) {
      org.organizationType = updateOrganizationDto.organizationType
    }

    const saved = await this.organizationRepository.save(org)
    return OrganizationResponseDto.fromEntity(saved)
  }

  async remove(id: string) {
    const result = await this.organizationRepository.delete(id)
    if (result.affected === 0) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND)
    }
    return { message: 'Deleted successfully' }
  }
}
