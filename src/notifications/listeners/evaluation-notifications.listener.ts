import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../notifications.service'
import { NotificationDelivery } from '../enums/notification-delivery.enum'
import { EVALUATION_EVENTS } from 'src/evaluations/evaluations.events'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'

@Injectable()
export class EvaluationNotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly parentProfilesService: ParentProfilesService,
  ) {}

  @OnEvent(EVALUATION_EVENTS.submitted)
  async onEvaluationSubmitted(payload: {
    attemptId: string
    evaluationId: string
    parentId: string
    childId: string
    score: number | null
    autoSubmitted?: boolean
  }) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(payload.parentId)
    if (!userId) return

    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'تم إرسال التقييم',
      message: payload.autoSubmitted
        ? 'تم إرسال التقييم تلقائيًا بعد انتهاء الوقت.'
        : 'تم إرسال التقييم بنجاح وفي انتظار الاعتماد.',
      type: 'evaluation_submitted',
      metadata: {
        attemptId: payload.attemptId,
        evaluationId: payload.evaluationId,
        childId: payload.childId,
      },
    })
  }

  @OnEvent(EVALUATION_EVENTS.approved)
  async onEvaluationApproved(payload: {
    attemptId: string
    evaluationId: string
    parentId: string
    childId: string
    approvedBy: string
    approvedAt: Date
  }) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(payload.parentId)
    if (!userId) return

    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'تم اعتماد نتيجة التقييم',
      message: 'تم اعتماد نتيجة تقييم طفلك ويمكنك الآن الاطلاع على النتيجة.',
      type: 'evaluation_approved',
      metadata: {
        attemptId: payload.attemptId,
        evaluationId: payload.evaluationId,
        childId: payload.childId,
      },
    })
  }

  @OnEvent(EVALUATION_EVENTS.limitReached)
  async onLimitReached(payload: {
    evaluationId: string
    parentId: string
    childId: string
    attempts: number
    reason: string
  }) {
    const userId = await this.parentProfilesService.getUserIdForParentProfile(payload.parentId)
    if (!userId) return

    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId,
      title: 'تم الوصول لحد المحاولات',
      message: 'تم الوصول إلى الحد الأقصى من محاولات التقييم.',
      type: 'evaluation_limit_reached',
      metadata: {
        evaluationId: payload.evaluationId,
        childId: payload.childId,
        attempts: payload.attempts,
        reason: payload.reason,
      },
    })
  }
}
