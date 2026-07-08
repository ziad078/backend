import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PrivateChild } from '../entities/private-child.entity'
import { ChildAccessPolicy } from '../policies/child-access.policy'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { AuditAction } from 'src/common/enums/audit-action.enum'
import { Actor } from 'src/common/policies/base-policy.interface'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Injectable()
export class PrivateChildrenService {
  constructor(
    @InjectRepository(PrivateChild)
    private privateChildRepo: Repository<PrivateChild>,
    private childAccessPolicy: ChildAccessPolicy,
    private auditService: AuditLoggingService,
  ) {}

  async create(dto: any, actor: Actor): Promise<PrivateChild> {
    const policyResult = this.childAccessPolicy.canCreate(actor)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED, policyResult.reason)
    }

    const child = this.privateChildRepo.create(dto)
    const saved = (await this.privateChildRepo.save(child)) as unknown as PrivateChild

    await this.auditService.logCreate(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'PrivateChild',
      saved.id,
      dto,
      'Created private child',
    )

    return saved
  }

  async findById(id: string, actor: Actor): Promise<PrivateChild> {
    const child = await this.privateChildRepo.findOne({
      where: { id },
      relations: ['parent'],
    })

    if (!child) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND, 'Child not found')
    }

    const policyResult = this.childAccessPolicy.canView(actor, child)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED, policyResult.reason)
    }

    return child
  }

  async update(id: string, dto: any, actor: Actor): Promise<PrivateChild> {
    const child = await this.findById(id, actor)
    const oldValue = { ...child }

    Object.assign(child, dto)
    const updated = await this.privateChildRepo.save(child)

    await this.auditService.logUpdate(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'PrivateChild',
      id,
      oldValue,
      dto,
      'Updated private child',
    )

    return updated
  }

  async delete(id: string, actor: Actor): Promise<void> {
    const child = await this.findById(id, actor)
    const oldValue = { ...child }

    await this.privateChildRepo.remove(child)

    await this.auditService.logDelete(
      actor.userId,
      actor.email || '',
      actor.roles.join(','),
      'PrivateChild',
      id,
      oldValue,
      'Deleted private child',
    )
  }

  async findByParent(parentUserId: string, actor: Actor): Promise<PrivateChild[]> {
    const policyResult = this.childAccessPolicy.canListPrivateChildren(actor, parentUserId)
    if (!policyResult.allowed) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED, policyResult.reason)
    }

    return this.privateChildRepo.find({
      where: { parent: { userId: parentUserId } },
      relations: ['parent'],
    })
  }
}
