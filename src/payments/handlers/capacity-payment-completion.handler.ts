import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { CapacityRequest } from 'src/capacity/entities/capacity-request.entity'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { CapacityRequestStatus } from 'src/common/enums/capacity-request-status.enum'
import { PaymentPurpose } from '../enums/payment-purpose.enum'
import { PAYMENT_EVENTS, type PaymentSuccessEventPayload } from '../payments.events'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { AuditAction } from 'src/common/enums/audit-action.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'

@Injectable()
export class CapacityPaymentCompletionHandler {
  private readonly logger = new Logger(CapacityPaymentCompletionHandler.name)

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CapacityRequest)
    private readonly capacityRequests: Repository<CapacityRequest>,
    private readonly auditService: AuditLoggingService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(PAYMENT_EVENTS.SUCCESS)
  async handlePaymentSuccess(payload: PaymentSuccessEventPayload): Promise<void> {
    if (payload.metadata.purpose !== PaymentPurpose.CAPACITY_INCREASE) {
      return
    }

    const capacityRequestId = payload.metadata.capacityRequestId
    if (!capacityRequestId || typeof capacityRequestId !== 'string') {
      this.logger.warn(`Capacity payment ${payload.paymentId} missing capacityRequestId metadata`)
      return
    }

    let parentUserId: string | null = null
    let requestedCapacity = 0
    let completed = false

    await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(CapacityRequest)
      const parentRepo = manager.getRepository(ParentProfile)

      const request = await requestRepo.findOne({
        where: { id: capacityRequestId },
        relations: ['parent', 'parent.user'],
        lock: { mode: 'pessimistic_write' },
      })

      if (!request) {
        this.logger.warn(`Capacity request ${capacityRequestId} not found for payment ${payload.paymentId}`)
        return
      }

      if (request.status === CapacityRequestStatus.COMPLETED) {
        this.logger.log(`Capacity request ${capacityRequestId} already completed — idempotent skip`)
        return
      }

      if (
        request.status !== CapacityRequestStatus.APPROVED &&
        request.status !== CapacityRequestStatus.PAID
      ) {
        this.logger.warn(
          `Capacity request ${capacityRequestId} in status ${request.status} — cannot complete`,
        )
        return
      }

      request.status = CapacityRequestStatus.COMPLETED
      request.paymentId = payload.paymentId
      await requestRepo.save(request)

      const parent = await parentRepo.findOne({
        where: { id: request.parentId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!parent) {
        this.logger.error(`Parent profile ${request.parentId} missing during capacity completion`)
        return
      }

      parent.maxChildren += request.requestedCapacity
      await parentRepo.save(parent)

      parentUserId = parent.userId
      requestedCapacity = request.requestedCapacity
      completed = true
    })

    if (!completed || !parentUserId) {
      return
    }

    await this.auditService.logCreate(
      parentUserId,
      '',
      'SYSTEM',
      'CapacityRequest',
      capacityRequestId,
      {
        paymentId: payload.paymentId,
        requestedCapacity,
        maxChildrenIncrement: requestedCapacity,
      },
      'Capacity payment completed — maxChildren increased',
    )

    await this.notifications.enqueue({
      userId: parentUserId,
      title: 'notifications.events.capacityCompleted.title',
      message: 'notifications.events.capacityCompleted.message',
      type: 'capacity_completed',
      delivery: NotificationDelivery.IN_APP,
      metadata: { count: requestedCapacity },
    })

    this.logger.log(
      `Completed capacity request ${capacityRequestId} via payment ${payload.paymentId}`,
    )
  }
}
