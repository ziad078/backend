import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { PaymentsService } from 'src/payments/payments.service'
import type { PaymentSuccessEventPayload } from 'src/payments/payments.events'
import { PAYMENT_EVENTS } from 'src/payments/payments.events'
import { AttemptUsageService } from '../attempt-usage.service'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'
import { EvaluationSlot } from '../entities/evaluation-slot.entity'
import { SlotKind } from '../enums/evaluation-slot-kind.enum'
import { SlotStatus } from '../enums/evaluation-slot-status.enum'

@Injectable()
export class EvaluationSlotService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PrivateChild)
    private readonly privateChildren: Repository<PrivateChild>,
    @InjectRepository(EvaluationSlot)
    private readonly slots: Repository<EvaluationSlot>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly attemptUsageService: AttemptUsageService,
    private readonly parentProfilesService: ParentProfilesService,
    private readonly config: ConfigService,
  ) {}

  private extraAttemptPriceSar(): number {
    return Number(this.config.get<string>('EXTRA_ATTEMPT_PRICE_SAR') ?? '199')
  }

  async loadPrivateChildOrThrow(
    childId: string,
    parentId: string,
    manager?: EntityManager,
  ): Promise<PrivateChild> {
    const repo = manager?.getRepository(PrivateChild) ?? this.privateChildren
    const child = await repo.findOne({
      where: { id: childId, parent: { id: parentId } },
    })

    if (!child) {
      throw new ForbiddenException('Private child not found for this parent')
    }

    return child
  }

  async startMainSlot(childId: string, parentUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
      const child = await this.loadPrivateChildOrThrow(childId, parentProfile.id, manager)
      const usage = await this.attemptUsageService.getUsage(child.id, parentProfile.id, manager)

      if (usage.totalAttempts > 0) {
        throw new BadRequestException('Main attempt already started or completed for this child')
      }

      const repo = manager.getRepository(EvaluationSlot)
      const existing = await repo.findOne({
        where: {
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.MAIN,
          evaluationAttemptId: IsNull(),
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      })

      if (existing && existing.status !== SlotStatus.COMPLETED) {
        return existing
      }

      return repo.save(
        repo.create({
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.MAIN,
          status: SlotStatus.READY,
          isPaid: false,
          requiresApproval: false,
          evaluationAttemptId: null,
          paymentId: null,
        }),
      )
    })
  }

  async requestRetake(childId: string, parentUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
      const child = await this.loadPrivateChildOrThrow(childId, parentProfile.id, manager)
      const usage = await this.attemptUsageService.getUsage(childId, parentProfile.id, manager)

      if (usage.totalAttempts < 1) {
        throw new BadRequestException('Complete the main attempt before retake')
      }

      if (usage.hasRetake) {
        throw new BadRequestException('Retake already used')
      }

      const repo = manager.getRepository(EvaluationSlot)
      const open = await repo.findOne({
        where: {
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.RETAKE,
          evaluationAttemptId: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      })

      if (open && open.status !== SlotStatus.COMPLETED) {
        await this.notifyRetakeRequested(parentProfile.id, child.name)
        return open
      }

      const saved = await repo.save(
        repo.create({
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.RETAKE,
          status: SlotStatus.READY,
          isPaid: false,
          requiresApproval: false,
          evaluationAttemptId: null,
          paymentId: null,
        }),
      )
      await this.notifyRetakeRequested(parentProfile.id, child.name)
      return saved
    })
  }

  async requestExtraAttempt(childId: string, parentUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
      const child = await this.loadPrivateChildOrThrow(childId, parentProfile.id, manager)
      const usage = await this.attemptUsageService.getUsage(childId, parentProfile.id, manager)

      if (usage.totalAttempts < 2 || !usage.hasRetake) {
        throw new BadRequestException(
          'Both free attempts must be completed before requesting an extra attempt',
        )
      }

      const repo = manager.getRepository(EvaluationSlot)
      const pending = await repo.findOne({
        where: {
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.EXTRA,
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      })

      if (
        pending &&
        pending.status !== SlotStatus.COMPLETED &&
        pending.status !== SlotStatus.REQUESTED
      ) {
        throw new BadRequestException('An extra attempt is already in progress or awaiting payment')
      }

      if (pending && pending.status === SlotStatus.REQUESTED) {
        throw new BadRequestException('Extra attempt already awaiting approval')
      }

      const saved = await repo.save(
        repo.create({
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.EXTRA,
          status: SlotStatus.REQUESTED,
          isPaid: false,
          requiresApproval: true,
          evaluationAttemptId: null,
          paymentId: null,
        }),
      )
      await this.notifyExtraRequested(parentProfile.id, child.name, saved.id)
      return saved
    })
  }

  async adminApproveExtraAttempt(privateAttemptId: string, adminUserId: string) {
    void adminUserId

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationSlot)
      const slot = await repo.findOne({
        where: { id: privateAttemptId },
        lock: {
          mode: 'pessimistic_write',
        },
      })

      if (!slot) throw new NotFoundException('Attempt request not found')

      const slotWithRelations = await repo.findOneOrFail({
        where: { id: slot.id },
        relations: {
          privateChild: true,
          parent: true,
        },
      })

      if (slotWithRelations.kind !== SlotKind.EXTRA) {
        throw new BadRequestException('Not an extra attempt request')
      }
      if (slotWithRelations.status !== SlotStatus.REQUESTED) {
        throw new BadRequestException('Extra attempt is not awaiting approval')
      }
      if (!slotWithRelations.requiresApproval) {
        throw new BadRequestException('Extra attempt does not require approval')
      }

      slotWithRelations.transitionTo(SlotStatus.AWAITING_PAYMENT)

      const parentUserId = await this.parentProfilesService.getUserIdForParentProfile(
        slotWithRelations.parentId,
      )
      const checkout = await this.payments.createPaymentForPrivateExtraAttempt(parentUserId, {
        privateChildId: slotWithRelations.privateChildId!,
        privateAttemptId: slotWithRelations.id,
        amount: this.extraAttemptPriceSar(),
        description: 'Extra child evaluation attempt',
      })
      slotWithRelations.paymentId = checkout.id

      await repo.save(slotWithRelations)
      await this.notifyPaymentRequired(
        slotWithRelations.parentId,
        slotWithRelations.privateChild!.name,
        checkout.checkoutUrl,
        checkout.expiresAt,
      )

      return {
        attempt: slotWithRelations,
        payment: checkout,
      }
    })
  }

  async initiateOrRefreshExtraPayment(privateAttemptId: string, parentUserId: string) {
    const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
    const slot = await this.slots.findOne({
      where: { id: privateAttemptId, parentId: parentProfile.id },
      relations: { privateChild: true },
    })

    if (!slot) throw new NotFoundException('Attempt not found')
    if (slot.status !== SlotStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Payment is not required for this attempt')
    }
    if (!slot.paymentId) {
      throw new BadRequestException('No payment record linked to this attempt')
    }

    const paymentUserId = await this.parentProfilesService.getUserIdForParentProfile(
      parentProfile.id,
    )
    const refreshed = await this.payments.retryPayment(slot.paymentId, paymentUserId)
    await this.notifyPaymentRequired(
      parentProfile.id,
      slot.privateChild!.name,
      refreshed.checkoutUrl,
      refreshed.expiresAt,
    )
    return refreshed
  }

  async findEntitlementForNext(
    manager: EntityManager,
    childId: string,
    parentId: string,
  ): Promise<EvaluationSlot | null> {
    return manager.getRepository(EvaluationSlot).findOne({
      where: {
        privateChildId: childId,
        parentId,
        status: SlotStatus.READY,
        evaluationAttemptId: IsNull(),
      },
      order: {
        createdAt: 'ASC',
      },
      lock: { mode: 'pessimistic_write' },
    })
  }

  async linkEvaluationToEntitlement(
    manager: EntityManager,
    entitlementId: string,
    evaluationAttemptId: string,
  ): Promise<void> {
    const repo = manager.getRepository(EvaluationSlot)
    const row = await repo.findOne({
      where: { id: entitlementId, status: SlotStatus.READY },
      lock: { mode: 'pessimistic_write' },
    })

    if (!row) throw new NotFoundException('Ready entitlement not found')

    row.transitionTo(SlotStatus.CONSUMED)
    row.evaluationAttemptId = evaluationAttemptId
    await repo.save(row)
  }

  async markPrivateAttemptCompleted(
    manager: EntityManager,
    evaluationAttemptId: string,
    childId: string,
  ): Promise<void> {
    const child = await manager.getRepository(PrivateChild).findOne({
      where: { id: childId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!child) return

    const repo = manager.getRepository(EvaluationSlot)
    const row = await repo.findOne({
      where: { evaluationAttemptId },
      lock: { mode: 'pessimistic_write' },
    })

    if (!row) return

    row.transitionTo(SlotStatus.COMPLETED)
    await repo.save(row)
  }

  @OnEvent(PAYMENT_EVENTS.SUCCESS)
  async handlePaymentSuccess(payload: PaymentSuccessEventPayload): Promise<void> {
    const privateId = payload.metadata.privateAttemptId
    if (!privateId || typeof privateId !== 'string') return

    let unlocked = false
    let childName: string | null = null

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationSlot)
      const row = await repo.findOne({
        where: { id: privateId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!row) return
      if (row.status !== SlotStatus.AWAITING_PAYMENT) return

      const rowWithRelations = await repo.findOneOrFail({
        where: { id: row.id },
        relations: {
          privateChild: true,
        },
      })

      rowWithRelations.transitionTo(SlotStatus.READY)
      rowWithRelations.isPaid = true
      rowWithRelations.paymentId = payload.paymentId
      await repo.save(rowWithRelations)
      unlocked = true
      childName = row.privateChild?.name || null
    })

    if (!unlocked) return

    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: payload.userId,
      title: 'Payment successful',
      message: `Payment received. You can start the extra evaluation for ${childName ?? 'your child'}.`,
    })
  }

  private async notifyRetakeRequested(parentId: string, childName: string) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(parentId)
    if (!userId) return
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'Retake requested',
      message: `A retake has been opened for ${childName}. You can start the evaluation when ready.`,
    })
  }

  private async notifyExtraRequested(parentId: string, childName: string, requestId: string) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(parentId)
    if (!userId) return
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'Extra attempt requested',
      message: `An extra evaluation attempt was requested for ${childName} (ref ${requestId}). Awaiting admin approval.`,
    })
  }

  private async notifyPaymentRequired(
    parentId: string,
    childName: string,
    paymentUrl: string,
    expiresAt: Date,
  ) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(parentId)
    if (!userId) return
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'Payment required',
      message: `Complete payment for an extra evaluation attempt for ${childName}. Pay here: ${paymentUrl} (expires ${expiresAt.toISOString()}).`,
    })
  }
}
