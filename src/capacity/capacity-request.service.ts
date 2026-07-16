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
import { PaymentsService } from 'src/payments/payments.service'
import { ConfigService } from '@nestjs/config'
import { NotificationsService } from 'src/notifications/notifications.service'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { PaymentPurpose } from 'src/payments/enums/payment-purpose.enum'

export type ApproveCapacityRequestResult = {
  capacityRequest: CapacityRequest
  payment: {
    id: string
    checkoutUrl: string
    expiresAt: Date
  }
}

@Injectable()
export class CapacityRequestService {
  constructor(
    @InjectRepository(CapacityRequest)
    private readonly capacityRequestRepository: Repository<CapacityRequest>,
    @InjectRepository(ParentProfile)
    private readonly parentProfileRepository: Repository<ParentProfile>,
    private readonly auditLoggingService: AuditLoggingService,
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private capacityUnitPriceSar(): number {
    return Number(this.config.get<string>('CAPACITY_UNIT_PRICE_SAR') ?? '99')
  }

  async create(
    createDto: CreateCapacityRequestDto,
    user: JwtRequestUser,
    request?: Request,
  ): Promise<CapacityRequest> {
    const parentProfile = await this.parentProfileRepository.findOne({
      where: { userId: user.userId },
    })

    if (!parentProfile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    const pendingExists = await this.capacityRequestRepository.exist({
      where: {
        parentId: parentProfile.id,
        status: CapacityRequestStatus.PENDING,
      },
    })
    if (pendingExists) {
      throw ApiException.conflict(ApiErrorCodes.CAPACITY_ALREADY_PENDING)
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
        relations: ['parent', 'parent.user'],
        order: { createdAt: 'DESC' },
      })
    }

    const parentProfile = await this.parentProfileRepository.findOne({
      where: { userId: user.userId },
    })

    if (!parentProfile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    return this.capacityRequestRepository.find({
      where: { parentId: parentProfile.id },
      relations: ['parent', 'parent.user'],
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, user: JwtRequestUser): Promise<CapacityRequest> {
    const capacityRequest = await this.capacityRequestRepository.findOne({
      where: { id },
      relations: ['parent', 'parent.user'],
    })

    if (!capacityRequest) {
      throw ApiException.notFound(ApiErrorCodes.CAPACITY_NOT_FOUND)
    }

    if (!hasRole(user.roles, UserRole.ADMIN)) {
      const parentProfile = await this.parentProfileRepository.findOne({
        where: { userId: user.userId },
      })

      if (!parentProfile || parentProfile.id !== capacityRequest.parentId) {
        throw ApiException.forbidden(ApiErrorCodes.CAPACITY_ACCESS_DENIED)
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
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    if (updateDto.status === CapacityRequestStatus.COMPLETED) {
      throw ApiException.badRequest(ApiErrorCodes.CAPACITY_INVALID_STATE, {
        reason: 'Capacity completion is triggered automatically after verified payment',
      })
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

    return updatedRequest
  }

  async approve(
    id: string,
    user: JwtRequestUser,
    request?: Request,
  ): Promise<ApproveCapacityRequestResult> {
    const capacityRequest = await this.findOne(id, user)

    if (!hasRole(user.roles, UserRole.ADMIN)) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    if (capacityRequest.status !== CapacityRequestStatus.PENDING) {
      throw ApiException.badRequest(ApiErrorCodes.CAPACITY_INVALID_STATE)
    }

    const parentUser = capacityRequest.parent?.user
    if (!parentUser) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    const amount = this.capacityUnitPriceSar() * capacityRequest.requestedCapacity
    const nameParts = (parentUser.name ?? 'Parent User').trim().split(/\s+/)
    const firstName = nameParts[0] ?? 'Parent'
    const lastName = nameParts.slice(1).join(' ') || 'User'

    capacityRequest.status = CapacityRequestStatus.APPROVED
    await this.capacityRequestRepository.save(capacityRequest)

    const payment = await this.paymentsService.createCapacityPayment({
      userId: parentUser.id,
      capacityRequestId: capacityRequest.id,
      requestedCapacity: capacityRequest.requestedCapacity,
      amount,
      description: `Additional child capacity (+${capacityRequest.requestedCapacity})`,
      billingData: {
        firstName,
        lastName,
        email: parentUser.email,
        phoneNumber: parentUser.phone,
      },
    })

    capacityRequest.paymentId = payment.id
    await this.capacityRequestRepository.save(capacityRequest)

    await this.auditLoggingService.log({
      userId: user.userId,
      userEmail: user.email,
      userRole: user.roles[0]?.name || UserRole.ADMIN,
      action: AuditAction.APPROVE,
      entityType: 'CapacityRequest',
      entityId: capacityRequest.id,
      newValue: {
        status: CapacityRequestStatus.APPROVED,
        paymentId: payment.id,
        amount,
        purpose: PaymentPurpose.CAPACITY_INCREASE,
      },
      description: 'Admin approved capacity request and issued Paymob payment link',
      request,
    })

    await this.notificationsService.enqueue({
      userId: parentUser.id,
      title: 'Capacity request approved — payment required',
      message: `Your request for ${capacityRequest.requestedCapacity} additional child slot(s) was approved. Complete payment to unlock capacity.`,
      delivery: NotificationDelivery.IN_APP,
    })

    return {
      capacityRequest,
      payment: {
        id: payment.id,
        checkoutUrl: payment.checkoutUrl,
        expiresAt: payment.expiresAt,
      },
    }
  }

  async reject(id: string, user: JwtRequestUser, request?: Request): Promise<CapacityRequest> {
    const capacityRequest = await this.findOne(id, user)

    if (!hasRole(user.roles, UserRole.ADMIN)) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    if (capacityRequest.status !== CapacityRequestStatus.PENDING) {
      throw ApiException.badRequest(ApiErrorCodes.CAPACITY_INVALID_STATE)
    }

    const oldValue = { ...capacityRequest }
    capacityRequest.status = CapacityRequestStatus.REJECTED
    const updatedRequest = await this.capacityRequestRepository.save(capacityRequest)

    await this.auditLoggingService.logUpdate(
      user.userId,
      user.email,
      user.roles[0]?.name || UserRole.ADMIN,
      'CapacityRequest',
      updatedRequest.id,
      oldValue as unknown as Record<string, unknown>,
      updatedRequest as unknown as Record<string, unknown>,
      'Admin rejected capacity request',
      request,
    )

    const parentUserId = capacityRequest.parent?.userId
    if (parentUserId) {
      await this.notificationsService.enqueue({
        userId: parentUserId,
        title: 'Capacity request rejected',
        message: 'Your request for additional child capacity was rejected by an administrator.',
        delivery: NotificationDelivery.IN_APP,
      })
    }

    return updatedRequest
  }

  async resolveCheckout(
    id: string,
    user: JwtRequestUser,
  ): Promise<{
    id: string
    checkoutUrl: string
    expiresAt: Date
    status: string
  }> {
    const capacityRequest = await this.findOne(id, user)

    if (capacityRequest.status !== CapacityRequestStatus.APPROVED) {
      throw ApiException.badRequest(ApiErrorCodes.CAPACITY_INVALID_STATE)
    }

    if (!capacityRequest.paymentId) {
      throw ApiException.notFound(ApiErrorCodes.PAYMENT_NOT_FOUND)
    }

    const parentUser = capacityRequest.parent?.user
    if (!parentUser) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    if (!hasRole(user.roles, UserRole.ADMIN) && user.userId !== parentUser.id) {
      throw ApiException.forbidden(ApiErrorCodes.CAPACITY_ACCESS_DENIED)
    }

    const session = await this.paymentsService.resolveCheckoutSession(
      capacityRequest.paymentId,
      parentUser.id,
    )

    return {
      id: session.id,
      checkoutUrl: session.checkoutUrl,
      expiresAt: session.expiresAt,
      status: session.status,
    }
  }
}
