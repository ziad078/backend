import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationChild } from '../entities/organization-child.entity'
import { ChildAccessPolicy } from '../policies/child-access.policy'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { Actor } from 'src/common/policies/base-policy.interface'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Injectable()
export class OrganizationChildrenService {
  constructor(
    @InjectRepository(OrganizationChild)
    private orgChildRepo: Repository<OrganizationChild>,
    private childAccessPolicy: ChildAccessPolicy,
    private auditService: AuditLoggingService,
  ) {}

  async create(dto: any, actor: Actor): Promise<OrganizationChild> {
    const policyResult = this.childAccessPolicy.canCreate(actor)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
    }

    const child = this.orgChildRepo.create(dto)
    const saved = (await this.orgChildRepo.save(child)) as unknown as OrganizationChild

    await this.auditService.logCreate(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'OrganizationChild',
      saved.id,
      dto,
      'Created organization child',
    )

    return saved
  }

  async findById(id: string, actor: Actor): Promise<OrganizationChild> {
    const child = await this.orgChildRepo.findOne({
      where: { id },
      relations: ['parent', 'organization', 'class', 'class.teacher', 'class.teacher.user'],
    })

    if (!child) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    const policyResult = this.childAccessPolicy.canView(actor, child)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
    }

    return child
  }

  async update(id: string, dto: any, actor: Actor): Promise<OrganizationChild> {
    const child = await this.findById(id, actor)
    const oldValue = { ...child }

    Object.assign(child, dto)
    const updated = await this.orgChildRepo.save(child)

    await this.auditService.logUpdate(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'OrganizationChild',
      id,
      oldValue,
      dto,
      'Updated organization child',
    )

    return updated
  }

  async delete(id: string, actor: Actor): Promise<void> {
    const child = await this.findById(id, actor)
    const oldValue = { ...child }

    await this.orgChildRepo.remove(child)

    await this.auditService.logDelete(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'OrganizationChild',
      id,
      oldValue,
      'Deleted organization child',
    )
  }

  async findByOrganization(organizationId: string, actor: Actor): Promise<OrganizationChild[]> {
    const policyResult = this.childAccessPolicy.canListOrganizationChildren(actor)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
    }

    return this.orgChildRepo.find({
      where: { organizationId },
      relations: ['parent', 'class'],
    })
  }

  async findByClass(classId: string): Promise<OrganizationChild[]> {
    return this.orgChildRepo.find({
      where: { classId },
      relations: ['parent', 'class'],
    })
  }
}
