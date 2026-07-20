import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { NotificationsService } from '../notifications.service'
import { NotificationDelivery } from '../enums/notification-delivery.enum'
import {
  UserEvents,
  type ParentCreatedEventPayload,
  type TeacherCreatedEventPayload,
} from 'src/users/enums/user-events.enum'

@Injectable()
export class AccountOnboardingNotificationListener {
  private readonly logger = new Logger(AccountOnboardingNotificationListener.name)

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(UserEvents.PARENT_CREATED)
  async onParentCreated(payload: ParentCreatedEventPayload) {
    if (!this.isDeliverableEmail(payload.email)) {
      this.logger.warn(
        `Skipping parent credentials email for placeholder address: ${payload.email}`,
      )
      return
    }

    try {
      await this.notifications.enqueue({
        delivery: NotificationDelivery.ACCOUNT_CREDENTIALS,
        userId: payload.userId,
        email: payload.email,
        phone: payload.phone,
        title: 'Parent account created',
        message: 'Your parent account has been created.',
        metadata: {
          name: payload.name,
          temporaryPassword: payload.temporaryPassword,
          roleLabel: 'ولي أمر',
          organizationId: payload.organizationId,
          organizationName: payload.organizationName,
        },
      })
    } catch (error) {
      this.logger.error(
        `Failed to enqueue parent onboarding email for ${payload.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  @OnEvent(UserEvents.TEACHER_CREATED)
  async onTeacherCreated(payload: TeacherCreatedEventPayload) {
    try {
      await this.notifications.enqueue({
        delivery: NotificationDelivery.ACCOUNT_CREDENTIALS,
        userId: payload.userId,
        email: payload.email,
        phone: payload.phone,
        title: 'Teacher account created',
        message: 'Your teacher account has been created.',
        metadata: {
          name: payload.name,
          temporaryPassword: payload.temporaryPassword,
          roleLabel: 'معلم',
          organizationId: payload.organizationId,
          organizationName: payload.organizationName,
          jobTitle: payload.jobTitle,
        },
      })
    } catch (error) {
      this.logger.error(
        `Failed to enqueue teacher onboarding email for ${payload.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private isDeliverableEmail(email: string): boolean {
    return Boolean(email?.trim()) && !email.endsWith('@placeholder.ithraa.local')
  }
}
