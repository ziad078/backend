import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { Repository } from 'typeorm'
import { CapacityRequest } from './entities/capacity-request.entity'
import { CreateCapacityRequestDto } from './dto/create-capacity-request.dto'
import { UpdateCapacityRequestDto } from './dto/update-capacity-request.dto'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { UserRole } from 'src/common/enums/role.enum'
import { CapacityRequestStatus } from 'src/common/enums/capacity-request-status.enum'
import { hasRole } from 'src/common/utils/has-role.util'
import { AuditAction } from 'src/common/enums/audit-action.enum'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { Request } from 'express'

@Injectable()
export class CapacityRequestService {
  constructor(
    @InjectRepository(CapacityRequest)
    private readonly capacityRequestRepository: Repository<CapacityRequest>,
    @InjectRepository(ParentProfile)
    private readonly parentProfileRepository: Repository<ParentProfile>,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  async create(
    createDto: CreateCapacityRequestDto,
    user: JwtRequestUser,
    request?: Request,
  ): Promise<CapacityRequest> {
    const parentProfile = await this.parentProfileRepository.findOne({
      where: { userId: user.userId },
    })

    if (!parentProfile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND, 'Parent profile not found')
    }

    const capacityRequest = this.capacityRequestRepository.create({
      parentId: parentProfile.id,
      requestedCapacity: createDto.requestedCapacity,
      notes: createDto.notes,
      status: CapacityRequestStatus.PENDING,
    })

    const savedRequest = await this.capacityRequestRepository.save(capacityRequest)

    await this.auditLoggingService.logCreate(
      user.userId,
      user.email,
      user.roles[0]?.name || UserRole.PARENT,
      'CapacityRequest',
      savedRequest.id,
      savedRequest as unknown as Record<string, unknown>,
      'Parent requested additional capacity',
      request,
    )

    return savedRequest
  }

  async findAll(user: JwtRequestUser): Promise<CapacityRequest[]> {
    if (hasRole(user.roles, UserRole.ADMIN)) {
      return this.capacityRequestRepository.find({
        relations: ['parent'],
        order: { createdAt: 'DESC' },
      })
    }

    const parentProfile = await this.parentProfileRepository.findOne({
      where: { userId: user.userId },
    })

    if (!parentProfile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND, 'Parent profile not found')
    }

    return this.capacityRequestRepository.find({
      where: { parentId: parentProfile.id },
      relations: ['parent'],
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, user: JwtRequestUser): Promise<CapacityRequest> {
    const capacityRequest = await this.capacityRequestRepository.findOne({
      where: { id },
      relations: ['parent'],
    })

    if (!capacityRequest) {
      throw ApiException.notFound(ApiErrorCodes.CAPACITY_NOT_FOUND, 'Capacity request not found')
    }

    if (!hasRole(user.roles, UserRole.ADMIN)) {
      const parentProfile = await this.parentProfileRepository.findOne({
        where: { userId: user.userId },
      })

      if (!parentProfile || parentProfile.id !== capacityRequest.parentId) {
        throw ApiException.forbidden(ApiErrorCodes.CAPACITY_ACCESS_DENIED, 'You do not have access to this capacity request')
      }
    }

    return capacityRequest
  }

  async update(
    id: string,
    updateDto: UpdateCapacityRequestDto,
    user: JwtRequestUser,
    request?: Request,
  ): Promise<CapacityRequest> {
    const capacityRequest = await this.findOne(id, user)

    if (!hasRole(user.roles, UserRole.ADMIN)) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'Only admins can update capacity requests')
    }

    const oldValue = { ...capacityRequest }

    Object.assign(capacityRequest, updateDto)

    const updatedRequest = await this.capacityRequestRepository.save(capacityRequest)

    await this.auditLoggingService.logUpdate(
      user.userId,
      user.email,
      user.roles[0]?.name || UserRole.ADMIN,
      'CapacityRequest',
      updatedRequest.id,
      oldValue as unknown as Record<string, unknown>,
      updatedRequest as unknown as Record<string, unknown>,
      'Admin updated capacity request',
      request,
    )

    // If status is completed, increase parent's maxChildren
    if (updateDto.status === CapacityRequestStatus.COMPLETED) {
      const parent = await this.parentProfileRepository.findOne({
        where: { id: updatedRequest.parentId },
      })

      if (parent) {
        parent.maxChildren += updatedRequest.requestedCapacity
        await this.parentProfileRepository.save(parent)
      }
    }

    return updatedRequest
  }

  async approve(id: string, user: JwtRequestUser, request?: Request): Promise<CapacityRequest> {
    return this.update(id, { status: CapacityRequestStatus.APPROVED }, user, request)
  }

  async reject(id: string, user: JwtRequestUser, request?: Request): Promise<CapacityRequest> {
    return this.update(id, { status: CapacityRequestStatus.REJECTED }, user, request)
  }

  async complete(
    id: string,
    user: JwtRequestUser,
    paymentId?: string,
    request?: Request,
  ): Promise<CapacityRequest> {
    return this.update(id, { status: CapacityRequestStatus.COMPLETED, paymentId }, user, request)
  }
}
