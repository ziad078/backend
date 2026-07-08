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

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  findAll(status?: ApprovalStatus) {
    const where = status ? { approvalStatus: status } : {}
    return this.organizationRepository
      .find({ where, order: { organizationName: 'ASC' } })
      .then((orgs) => orgs.map(OrganizationResponseDto.fromEntity))
  }

  findPending() {
    return this.findAll(ApprovalStatus.PENDING)
  }

  async findOne(id: string) {
    const org = await this.findOneOrFail(id)
    return OrganizationResponseDto.fromEntity(org)
  }

  async findOneOrFail(id: string): Promise<Organization> {
    const org = await this.organizationRepository.findOneBy({ id })
    if (!org) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, `Organization with this id ${id} is not found`)
    }
    return org
  }

  async assertOrganizationApproved(organizationId: string): Promise<Organization> {
    const org = await this.findOneOrFail(organizationId)
    if (org.approvalStatus !== ApprovalStatus.APPROVED) {
      throw ApiException.forbidden(ApiErrorCodes.ORGANIZATION_NOT_APPROVED, 'Organization must be approved before performing this operation')
    }
    return org
  }

  async findByParent(id: string) {
    const org = await this.organizationRepository
      .createQueryBuilder('org')
      .leftJoin('parent_organizations', 'link', 'link.organizationId = org.id')
      .leftJoin('organization_children', 'child', 'child.organizationId = org.id')
      .where('link.parentId = :parentId', { parentId: id })
      .orWhere('child.parentId = :parentId', { parentId: id })
      .getOne()

    if (!org) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, `Parent with id ${id} is not related to any organization`)
    }

    return OrganizationResponseDto.fromEntity(org)
  }

  async findByOwner(ownerId: string) {
    const org = await this.organizationRepository.findOne({
      where: { owner: { id: ownerId } },
    })
    if (!org) {
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, `Organization for this owner with ${ownerId} is not found`)
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
    throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You do not have access to this organization')
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
    const org = await this.findOneOrFail(id)

    if (org.approvalStatus === ApprovalStatus.APPROVED) {
      throw ApiException.conflict(ApiErrorCodes.ORGANIZATION_ALREADY_APPROVED, 'Organization is already approved')
    }

    org.approvalStatus = ApprovalStatus.APPROVED
    org.approvedById = adminId
    org.approvedAt = new Date()
    org.rejectedById = null
    org.rejectedAt = null
    org.rejectionReason = null

    const saved = await this.organizationRepository.save(org)
    return OrganizationResponseDto.fromEntity(saved)
  }

  async reject(
    id: string,
    adminId: string,
    rejectionReason: string,
  ): Promise<OrganizationResponseDto> {
    const org = await this.findOneOrFail(id)

    if (org.approvalStatus === ApprovalStatus.REJECTED) {
      throw ApiException.conflict(ApiErrorCodes.ORGANIZATION_ALREADY_REJECTED, 'Organization is already rejected')
    }

    org.approvalStatus = ApprovalStatus.REJECTED
    org.rejectedById = adminId
    org.rejectedAt = new Date()
    org.rejectionReason = rejectionReason
    org.approvedById = null
    org.approvedAt = null

    const saved = await this.organizationRepository.save(org)
    return OrganizationResponseDto.fromEntity(saved)
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto, actor: JwtRequestUser) {
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
      throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found')
    }
    return { message: 'Deleted successfully' }
  }
}
