import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { NotificationsService } from 'src/notifications/notifications.service'
import { PaymentsService } from 'src/payments/payments.service'
import type { PaymentSuccessEventPayload } from 'src/payments/payments.events'
import { PAYMENT_EVENTS } from 'src/payments/payments.events'
import { PaymentPurpose } from 'src/payments/enums/payment-purpose.enum'
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
    @InjectRepository(OrganizationChild)
    private readonly organizationChildren: Repository<OrganizationChild>,
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
      throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    return child
  }

  async loadOrganizationChildOrThrow(
    childId: string,
    parentId: string,
    manager?: EntityManager,
  ): Promise<OrganizationChild> {
    const repo = manager?.getRepository(OrganizationChild) ?? this.organizationChildren
    const child = await repo.findOne({
      where: { id: childId, parent: { id: parentId } },
    })

    if (!child) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    return child
  }

  async resolveParentChildOrThrow(childId: string, parentId: string) {
    const privateChild = await this.privateChildren.findOne({
      where: { id: childId, parent: { id: parentId } },
    })

    if (privateChild) {
      return { child: privateChild, isPrivateChild: true as const }
    }

    const orgChild = await this.organizationChildren.findOne({
      where: { id: childId, parent: { id: parentId } },
    })

    if (!orgChild) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    return { child: orgChild, isPrivateChild: false as const }
  }

  async startMainSlot(childId: string, parentUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
      const child = await this.loadPrivateChildOrThrow(childId, parentProfile.id, manager)
      const usage = await this.attemptUsageService.getUsage(child.id, parentProfile.id, manager)

      if (usage.totalAttempts > 0) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      const repo = manager.getRepository(EvaluationSlot)
      // Look up the latest MAIN slot regardless of whether it's already linked
      // to an attempt. A CONSUMED slot (attempt in progress) must be returned
      // as-is, otherwise re-inserting would hit the active-kind unique index.
      const existing = await repo.findOne({
        where: {
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.MAIN,
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
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      if (usage.hasRetake) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_MAX_ATTEMPTS)
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

  async requestExtraAttempt(childId: string, parentUserId: string, quantity = 1) {
    const requestedQuantity = Math.max(1, Math.min(Math.trunc(quantity) || 1, 10))

    return this.dataSource.transaction(async (manager) => {
      const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
      const child = await this.loadPrivateChildOrThrow(childId, parentProfile.id, manager)
      const usage = await this.attemptUsageService.getUsage(childId, parentProfile.id, manager)

      if (usage.totalAttempts < 2 || !usage.hasRetake) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_MAX_ATTEMPTS)
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
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      if (pending && pending.status === SlotStatus.REQUESTED) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      const saved = await repo.save(
        repo.create({
          privateChildId: childId,
          parentId: parentProfile.id,
          kind: SlotKind.EXTRA,
          status: SlotStatus.REQUESTED,
          isPaid: false,
          requiresApproval: true,
          quantity: requestedQuantity,
          usedCount: 0,
          evaluationAttemptId: null,
          paymentId: null,
        }),
      )
      await this.notifyExtraRequested(parentProfile.id, child.name, saved.id)
      return saved
    })
  }

  /**
   * Read-only snapshot of a private child's evaluation entitlement state,
   * used to drive the state-aware parent UI (free attempts remaining,
   * available actions, and the current paid-extra request lifecycle).
   */
  async getChildEvaluationState(childId: string, parentUserId: string) {
    const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
    const resolved = await this.resolveParentChildOrThrow(childId, parentProfile.id)

    if (!resolved.isPrivateChild) {
      const usage = await this.attemptUsageService.getUsage(childId, parentProfile.id)
      const FREE_ATTEMPTS_LIMIT = 2

      return {
        childId,
        childType: 'organization' as const,
        totalAttempts: usage.totalAttempts,
        freeAttemptsLimit: FREE_ATTEMPTS_LIMIT,
        freeAttemptsUsed: Math.min(usage.totalAttempts, FREE_ATTEMPTS_LIMIT),
        freeAttemptsRemaining: Math.max(0, FREE_ATTEMPTS_LIMIT - usage.totalAttempts),
        hasRetake: usage.hasRetake,
        hasReadySlot: true,
        readySlotKind: null,
        inProgressAttemptId: usage.inProgressAttempt?.id ?? null,
        canOpenMain: false,
        canRequestRetake: false,
        canRequestExtra: false,
        extra: null,
      }
    }

    await this.loadPrivateChildOrThrow(childId, parentProfile.id)
    const usage = await this.attemptUsageService.getUsage(childId, parentProfile.id)

    const FREE_ATTEMPTS_LIMIT = 2
    const freeAttemptsRemaining = Math.max(0, FREE_ATTEMPTS_LIMIT - usage.totalAttempts)

    const slots = await this.slots.find({
      where: { privateChildId: childId, parentId: parentProfile.id },
      order: { createdAt: 'DESC' },
    })

    const inProgress = usage.inProgressAttempt != null

    const readySlot =
      slots.find((slot) => slot.status === SlotStatus.READY && !slot.evaluationAttemptId) ?? null

    // A pending (unpaid) extra request blocks new requests; already-paid READY
    // extras don't, since the parent can simply start them.
    const pendingExtraSlot =
      slots.find(
        (slot) =>
          slot.kind === SlotKind.EXTRA &&
          (slot.status === SlotStatus.REQUESTED || slot.status === SlotStatus.AWAITING_PAYMENT),
      ) ?? null

    // Latest non-completed extra slot drives the request stepper.
    const extraSlot =
      slots.find(
        (slot) => slot.kind === SlotKind.EXTRA && slot.status !== SlotStatus.COMPLETED,
      ) ?? null

    return {
      childId,
      childType: 'private' as const,
      totalAttempts: usage.totalAttempts,
      freeAttemptsLimit: FREE_ATTEMPTS_LIMIT,
      freeAttemptsUsed: Math.min(usage.totalAttempts, FREE_ATTEMPTS_LIMIT),
      freeAttemptsRemaining,
      hasRetake: usage.hasRetake,
      hasReadySlot: readySlot != null,
      readySlotKind: readySlot ? SlotKind[readySlot.kind] : null,
      inProgressAttemptId: usage.inProgressAttempt?.id ?? null,
      canOpenMain: usage.totalAttempts === 0 && readySlot == null && !inProgress,
      canRequestRetake:
        usage.totalAttempts >= 1 && !usage.hasRetake && readySlot == null && !inProgress,
      canRequestExtra:
        usage.totalAttempts >= FREE_ATTEMPTS_LIMIT &&
        usage.hasRetake &&
        readySlot == null &&
        pendingExtraSlot == null &&
        !inProgress,
      extra: extraSlot
        ? {
            slotId: extraSlot.id,
            status: extraSlot.status,
            paymentId: extraSlot.paymentId,
            isPaid: extraSlot.isPaid,
            quantity: extraSlot.quantity,
            remaining: Math.max(0, extraSlot.quantity - extraSlot.usedCount),
          }
        : null,
    }
  }

  /**
   * Admin view of pending paid extra-attempt requests (awaiting approval or
   * awaiting payment after approval).
   */
  async listExtraAttemptRequests() {
    const rows = await this.slots.find({
      where: [
        { kind: SlotKind.EXTRA, status: SlotStatus.REQUESTED },
        { kind: SlotKind.EXTRA, status: SlotStatus.AWAITING_PAYMENT },
      ],
      relations: { privateChild: true, parent: { user: true } },
      order: { createdAt: 'DESC' },
    })

    const unitPrice = this.extraAttemptPriceSar()
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      quantity: row.quantity,
      unitPriceSar: unitPrice,
      amountSar: unitPrice * row.quantity,
      childId: row.privateChildId,
      childName: row.privateChild?.name ?? null,
      parentId: row.parentId,
      parentName: row.parent?.user?.name ?? null,
      parentEmail: row.parent?.user?.email ?? null,
      parentPhone: row.parent?.user?.phone ?? null,
      paymentId: row.paymentId,
      createdAt: row.createdAt,
    }))
  }

  async adminRejectExtraAttempt(slotId: string, adminUserId: string) {
    void adminUserId

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationSlot)
      const slot = await repo.findOne({
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!slot) throw ApiException.notFound(ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND)
      if (slot.kind !== SlotKind.EXTRA || slot.status !== SlotStatus.REQUESTED) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      const { parentId, privateChildId } = slot
      // Removing the pending request frees the active-kind unique index so the
      // parent can submit a fresh request later.
      await repo.remove(slot)

      let childName: string | null = null
      if (privateChildId) {
        const child = await manager.getRepository(PrivateChild).findOne({
          where: { id: privateChildId },
        })
        childName = child?.name ?? null
      }
      await this.notifyExtraRejected(parentId, childName)

      return { id: slotId, status: 'REJECTED' as const }
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

      if (!slot) throw ApiException.notFound(ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND)

      const slotWithRelations = await repo.findOneOrFail({
        where: { id: slot.id },
        relations: {
          privateChild: true,
          parent: true,
        },
      })

      if (slotWithRelations.kind !== SlotKind.EXTRA) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }
      if (slotWithRelations.status !== SlotStatus.REQUESTED) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }
      if (!slotWithRelations.requiresApproval) {
        throw ApiException.badRequest(ApiErrorCodes.EVALUATION_ATTEMPT_LOCKED)
      }

      slotWithRelations.transitionTo(SlotStatus.AWAITING_PAYMENT)

      const parentUserId = await this.parentProfilesService.getUserIdForParentProfile(
        slotWithRelations.parentId,
      )
      const quantity = Math.max(1, slotWithRelations.quantity)
      const checkout = await this.payments.createPaymentForPrivateExtraAttempt(parentUserId, {
        privateChildId: slotWithRelations.privateChildId!,
        privateAttemptId: slotWithRelations.id,
        amount: this.extraAttemptPriceSar() * quantity,
        description:
          quantity > 1
            ? `${quantity} extra child evaluation attempts`
            : 'Extra child evaluation attempt',
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

    if (!slot) throw ApiException.notFound(ApiErrorCodes.EVALUATION_ATTEMPT_NOT_FOUND)
    if (slot.status !== SlotStatus.AWAITING_PAYMENT) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_FAILED)
    }
    if (!slot.paymentId) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_NOT_FOUND)
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

    if (!row) throw ApiException.notFound(ApiErrorCodes.EVALUATION_SLOT_NOT_FOUND)

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

    // Multi-attempt (paid EXTRA) entitlements: once a use completes, spawn a
    // fresh READY slot carrying the incremented usage count until all paid
    // attempts are consumed. This grants N attempts while preserving the
    // "one active slot per kind" invariant.
    const consumed = row.usedCount + 1
    if (row.kind === SlotKind.EXTRA && consumed < row.quantity) {
      await repo.save(
        repo.create({
          privateChildId: row.privateChildId,
          organizationChildId: row.organizationChildId,
          parentId: row.parentId,
          kind: SlotKind.EXTRA,
          status: SlotStatus.READY,
          isPaid: true,
          requiresApproval: false,
          quantity: row.quantity,
          usedCount: consumed,
          evaluationAttemptId: null,
          paymentId: row.paymentId,
        }),
      )
    }
  }

  @OnEvent(PAYMENT_EVENTS.SUCCESS)
  async handlePaymentSuccess(payload: PaymentSuccessEventPayload): Promise<void> {
    if (payload.metadata.purpose !== PaymentPurpose.PRIVATE_EXTRA_ATTEMPT) {
      return
    }

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
      childName = rowWithRelations.privateChild?.name || null
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

  private async notifyExtraRejected(parentId: string, childName: string | null) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(parentId)
    if (!userId) return
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'Extra attempt request declined',
      message: childName
        ? `Your extra evaluation attempt request for ${childName} was declined by an administrator.`
        : 'Your extra evaluation attempt request was declined by an administrator.',
    })
  }
}
