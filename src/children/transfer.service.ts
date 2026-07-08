import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Class } from 'src/classes/entities/class.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { TransferRequest } from 'src/children/entities/transfer-request.entity'
import { TransferRequestStatus } from 'src/children/enums/transfer-request-status.enum'
import { Organization } from 'src/organizations/entities/organization.entity'
import { EntityManager, Repository } from 'typeorm'
import { ListTransferRequestsDto } from './dto/list-transfer-requests.dto'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { AuditAction } from 'src/common/enums/audit-action.enum'
import { TransferAccessPolicy } from './policies/transfer-access.policy'
import {
  resolveChild,
  getChildId,
  getChildType,
  ensureSingleChildType,
} from 'src/common/helpers/child-resolver.helper'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(TransferRequest)
    private readonly transferRequests: Repository<TransferRequest>,
    @InjectRepository(OrganizationChild)
    private readonly organizationChildren: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private readonly privateChildren: Repository<PrivateChild>,
    @InjectRepository(Class)
    private readonly classes: Repository<Class>,
    private readonly auditService: AuditLoggingService,
    private readonly transferAccessPolicy: TransferAccessPolicy,
  ) {}

  async requestTransfer(
    childId: string,
    childType: 'organization' | 'private',
    toOrganizationId: string,
    requestingUserId: string,
    requestingUserEmail: string,
    requestingUserRoles: string[],
    manager?: EntityManager,
  ): Promise<TransferRequest> {
    const transferRepo = manager ? manager.getRepository(TransferRequest) : this.transferRequests
    const orgChildRepo = manager
      ? manager.getRepository(OrganizationChild)
      : this.organizationChildren
    const privateChildRepo = manager ? manager.getRepository(PrivateChild) : this.privateChildren
    const orgRepo = manager
      ? manager.getRepository(Organization)
      : this.transferRequests.manager.getRepository(Organization)

    let fromOrganizationId: string

    if (childType === 'organization') {
      const orgChild = await orgChildRepo.findOne({
        where: { id: childId },
        relations: ['organization', 'class'],
      })
      if (!orgChild) throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND, 'Child not found')
      fromOrganizationId = orgChild.organizationId
      if (fromOrganizationId === toOrganizationId) {
        throw ApiException.conflict(ApiErrorCodes.CHILD_DUPLICATE, 'Child already exists in your school')
      }
    } else {
      const privateChild = await privateChildRepo.findOne({ where: { id: childId } })
      if (!privateChild) throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND, 'Child not found')
      throw ApiException.badRequest(ApiErrorCodes.TRANSFER_INVALID_CHILD_TYPE, 'Cannot transfer private child - only organization children can be transferred')
    }

    const toOrganization = await orgRepo.findOneBy({ id: toOrganizationId })
    if (!toOrganization) throw ApiException.notFound(ApiErrorCodes.ORGANIZATION_NOT_FOUND, 'Target organization not found')

    const whereClause: any = {
      fromOrganizationId,
      toOrganizationId,
      status: TransferRequestStatus.PENDING,
    }

    if (childType === 'organization') {
      whereClause.organizationChildId = childId
    } else {
      whereClause.privateChildId = childId
    }

    const existingPending = await transferRepo.findOne({
      where: whereClause,
    })
    if (existingPending) return existingPending

    const transferData: any = {
      fromOrganizationId,
      toOrganizationId,
      status: TransferRequestStatus.PENDING,
    }

    if (childType === 'organization') {
      transferData.organizationChildId = childId
    } else {
      transferData.privateChildId = childId
    }

    const transfer = transferRepo.create(transferData)
    const saved = (await transferRepo.save(transfer)) as unknown as TransferRequest

    await this.auditService.logCreate(
      requestingUserId,
      requestingUserEmail,
      requestingUserRoles.join(','),
      'TransferRequest',
      saved.id,
      { childId, childType, toOrganizationId },
      'Requested child transfer',
    )

    return saved
  }

  async approveTransfer(
    transferRequestId: string,
    classId: string,
    approvingUserId: string,
    approvingUserEmail: string,
    approvingUserRoles: string[],
    manager?: EntityManager,
  ): Promise<TransferRequest> {
    const transferRepo = manager ? manager.getRepository(TransferRequest) : this.transferRequests
    const orgChildRepo = manager
      ? manager.getRepository(OrganizationChild)
      : this.organizationChildren
    const classRepo = manager ? manager.getRepository(Class) : this.classes

    const transfer = await transferRepo.findOne({
      where: { id: transferRequestId },
      relations: ['fromOrganization', 'toOrganization', 'organizationChild', 'privateChild'],
    })
    if (!transfer) throw ApiException.notFound(ApiErrorCodes.TRANSFER_NOT_FOUND, 'Transfer request not found')
    if (transfer.status !== TransferRequestStatus.PENDING) {
      throw ApiException.conflict(ApiErrorCodes.TRANSFER_ALREADY_RESOLVED, 'Transfer request is already resolved')
    }

    const cls = await classRepo.findOne({
      where: { id: classId },
      relations: { organization: true },
    })
    if (!cls) throw ApiException.notFound(ApiErrorCodes.CLASS_NOT_FOUND, 'Class not found')
    if (cls.organization.id !== transfer.toOrganizationId) {
      throw ApiException.badRequest(ApiErrorCodes.CLASS_NOT_FOUND, 'Class must belong to the target organization')
    }

    const oldValue = { status: transfer.status }
    transfer.status = TransferRequestStatus.APPROVED
    await transferRepo.save(transfer)

    if (transfer.organizationChildId) {
      await orgChildRepo.update({ id: transfer.organizationChildId }, { classId })
    } else {
      throw ApiException.badRequest(ApiErrorCodes.TRANSFER_INVALID_CHILD_TYPE, 'Cannot approve transfer for private child')
    }

    await this.auditService.logApprove(
      approvingUserId,
      approvingUserEmail,
      approvingUserRoles.join(','),
      'TransferRequest',
      transferRequestId,
      'Approved child transfer',
    )

    return transfer
  }

  async rejectTransfer(
    transferRequestId: string,
    rejectingUserId: string,
    rejectingUserEmail: string,
    rejectingUserRoles: string[],
    manager?: EntityManager,
  ): Promise<TransferRequest> {
    const transferRepo = manager ? manager.getRepository(TransferRequest) : this.transferRequests

    const transfer = await transferRepo.findOne({
      where: { id: transferRequestId },
    })
    if (!transfer) throw ApiException.notFound(ApiErrorCodes.TRANSFER_NOT_FOUND, 'Transfer request not found')
    if (transfer.status !== TransferRequestStatus.PENDING) {
      throw ApiException.conflict(ApiErrorCodes.TRANSFER_ALREADY_RESOLVED, 'Transfer request is already resolved')
    }

    const oldValue = { status: transfer.status }
    transfer.status = TransferRequestStatus.REJECTED
    await transferRepo.save(transfer)

    await this.auditService.logReject(
      rejectingUserId,
      rejectingUserEmail,
      rejectingUserRoles.join(','),
      'TransferRequest',
      transferRequestId,
      'Rejected child transfer',
    )

    return transfer
  }

  async getTransferRequests(query: ListTransferRequestsDto) {
    const qb = this.transferRequests
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.organizationChild', 'organizationChild')
      .leftJoinAndSelect('organizationChild.class', 'orgClass')
      .leftJoinAndSelect('transfer.privateChild', 'privateChild')
      .leftJoinAndSelect('transfer.fromOrganization', 'fromOrganization')
      .leftJoinAndSelect('transfer.toOrganization', 'toOrganization')
      .orderBy('transfer.createdAt', 'DESC')

    if (query.toOrganizationId) {
      qb.andWhere('transfer.toOrganizationId = :toOrganizationId', {
        toOrganizationId: query.toOrganizationId,
      })
    }

    if (query.fromOrganizationId) {
      qb.andWhere('transfer.fromOrganizationId = :fromOrganizationId', {
        fromOrganizationId: query.fromOrganizationId,
      })
    }

    if (query.status) {
      qb.andWhere('transfer.status = :status', {
        status: query.status,
      })
    }

    const requests = await qb.getMany()

    return {
      requests: requests.map((request) => {
        const child = resolveChild(request)
        const childType = getChildType(request)
        const childId = getChildId(request)

        return {
          id: request.id,
          childId,
          childType,
          organizationChildId: request.organizationChildId,
          privateChildId: request.privateChildId,
          fromOrganizationId: request.fromOrganizationId,
          toOrganizationId: request.toOrganizationId,
          status: request.status.toLowerCase(),
          createdAt: request.createdAt,

          child: child
            ? {
                id: child.id,
                name: child.name,
                birthDate: child.birthDate,
                type: childType,
                class:
                  childType === 'organization' && request.organizationChild?.class
                    ? {
                        id: request.organizationChild.class.id,
                        name: request.organizationChild.class.name,
                      }
                    : null,
              }
            : null,

          fromOrganization: request.fromOrganization
            ? {
                id: request.fromOrganization.id,
                organizationName: request.fromOrganization.organizationName,
              }
            : null,

          toOrganization: request.toOrganization
            ? {
                id: request.toOrganization.id,
                organizationName: request.toOrganization.organizationName,
              }
            : null,
        }
      }),
    }
  }
}
