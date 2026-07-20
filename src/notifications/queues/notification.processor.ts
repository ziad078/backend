import { Process, Processor, OnQueueFailed } from '@nestjs/bull'
import type { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { EmailProvider } from '../providers/email.provider'
import { InAppProvider } from '../providers/inapp.provider'
import { NotificationDelivery } from '../enums/notification-delivery.enum'
import type { NotificationSendJobPayload } from '../interfaces/notification-job.interface'
import { AuthProvider } from 'src/users/services/auth.provider'

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(
    private readonly email: EmailProvider,
    private readonly inApp: InAppProvider,
    private readonly authService: AuthProvider,
  ) {}

  @OnQueueFailed({ name: 'send' })
  onFailed(job: Job<NotificationSendJobPayload>, err: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`,
      err.stack,
    )
  }

  @Process({
    name: 'send',
    concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY ?? 5),
  })
  async handleSend(job: Job<NotificationSendJobPayload>): Promise<void> {
    const { delivery, userId, phone, email, title, message, type, metadata } = job.data
    const requiresContent =
      delivery !== NotificationDelivery.VERIFY_EMAIL &&
      delivery !== NotificationDelivery.ACCOUNT_CREDENTIALS

    if (requiresContent && (!title?.trim() || !message?.trim())) {
      this.logger.warn(`Job ${job.id}: missing title or message, skipping`)
      return
    }

    const sendEmail =
      delivery === NotificationDelivery.EMAIL || delivery === NotificationDelivery.BOTH

    const sendVerificationEmail = delivery === NotificationDelivery.VERIFY_EMAIL
    const sendCredentialsEmail = delivery === NotificationDelivery.ACCOUNT_CREDENTIALS
    const sendInApp =
      delivery === NotificationDelivery.IN_APP || delivery === NotificationDelivery.BOTH

    if (sendEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: email delivery requested but no email address provided, skipping`,
        )
        return
      }
      await this.email.sendEmail(email, title, message)
    }
    if (sendVerificationEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: email delivery requested but no email address provided, skipping`,
        )
        return
      }
      const token = this.authService.generateVerificationToken(userId)
      await this.email.sendVerificationEmail(email, token)
    }

    if (sendCredentialsEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: credentials email requested but no email address provided, skipping`,
        )
        return
      }
      if (!phone?.trim()) {
        this.logger.warn(
          `Job ${job.id}: credentials phone requested but no email address provided, skipping`,
        )
        return
      }
      const credentials = metadata as {
        name?: string
        temporaryPassword?: string
        roleLabel?: string
      }
      if (!credentials?.temporaryPassword || !credentials?.name) {
        this.logger.warn(`Job ${job.id}: credentials metadata incomplete, skipping`)
        return
      }
      await this.email.sendCredentialsEmail(email, phone, {
        name: credentials.name,
        temporaryPassword: credentials.temporaryPassword,
        roleLabel: credentials.roleLabel ?? 'مستخدم',
      })
    }

    if (sendInApp) {
      await this.inApp.create(userId, title, message, type ?? 'general', metadata ?? null)
    }
  }
}
