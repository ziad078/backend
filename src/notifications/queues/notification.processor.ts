import { Process, Processor, OnQueueFailed } from '@nestjs/bull'
import type { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EmailProvider } from '../providers/email.provider'
import { InAppProvider } from '../providers/inapp.provider'
import { NotificationDelivery } from '../enums/notification-delivery.enum'
import type { NotificationSendJobPayload } from '../interfaces/notification-job.interface'
import { AuthProvider } from 'src/users/services/auth.provider'
import { User } from 'src/users/entities/user.entity'

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(
    private readonly email: EmailProvider,
    private readonly inApp: InAppProvider,
    private readonly authService: AuthProvider,
    @InjectRepository(User)
    private readonly users: Repository<User>,
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
      delivery !== NotificationDelivery.RESET_PASSWORD &&
      delivery !== NotificationDelivery.ACCOUNT_CREDENTIALS

    if (requiresContent && (!title?.trim() || !message?.trim())) {
      this.logger.warn(`Job ${job.id}: missing title or message, skipping`)
      return
    }

    const sendEmail =
      delivery === NotificationDelivery.EMAIL || delivery === NotificationDelivery.BOTH
    const sendVerificationEmail = delivery === NotificationDelivery.VERIFY_EMAIL
    const sendPasswordResetEmail = delivery === NotificationDelivery.RESET_PASSWORD
    const sendCredentialsEmail = delivery === NotificationDelivery.ACCOUNT_CREDENTIALS
    const sendInApp =
      delivery === NotificationDelivery.IN_APP || delivery === NotificationDelivery.BOTH

    const emailFailures: string[] = []
    const inAppFailures: string[] = []

    if (sendEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: email delivery requested but no email address provided, skipping`,
        )
      } else {
        try {
          await this.email.sendEmail(email, title, message)
        } catch (error) {
          emailFailures.push('general_email')
          this.logger.error(
            `Job ${job.id}: general email failed for ${email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
    }

    if (sendVerificationEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: verification email requested but no email address provided, skipping`,
        )
      } else {
        try {
          const user = await this.users.findOne({
            where: { id: userId },
            select: ['id', 'isEmailVerified'],
          })

          if (user?.isEmailVerified) {
            this.logger.log(`Job ${job.id}: user ${userId} already verified, skipping email`)
          } else {
            const token = this.authService.generateVerificationToken(userId)
            await this.email.sendVerificationEmail(email, token)
          }
        } catch (error) {
          emailFailures.push('verification_email')
          this.logger.error(
            `Job ${job.id}: verification email failed for ${email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
    }

    if (sendPasswordResetEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: password reset requested but no email address provided, skipping`,
        )
      } else {
        try {
          const token = this.authService.generatePasswordResetToken(userId)
          await this.email.sendPasswordResetEmail(email, token)
        } catch (error) {
          emailFailures.push('reset_password_email')
          this.logger.error(
            `Job ${job.id}: password reset email failed for ${email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
    }

    if (sendCredentialsEmail) {
      if (!email?.trim()) {
        this.logger.warn(
          `Job ${job.id}: credentials email requested but no email address provided, skipping`,
        )
      } else if (!phone?.trim()) {
        this.logger.warn(
          `Job ${job.id}: credentials email requested but no phone provided, skipping`,
        )
      } else {
        const credentials = metadata as {
          name?: string
          temporaryPassword?: string
          roleLabel?: string
        }
        if (!credentials?.temporaryPassword || !credentials?.name) {
          this.logger.warn(`Job ${job.id}: credentials metadata incomplete, skipping`)
        } else {
          try {
            await this.email.sendCredentialsEmail(email, phone, {
              name: credentials.name,
              temporaryPassword: credentials.temporaryPassword,
              roleLabel: credentials.roleLabel ?? 'مستخدم',
            })
          } catch (error) {
            emailFailures.push('credentials_email')
            this.logger.error(
              `Job ${job.id}: credentials email failed for ${email}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            )
          }
        }
      }
    }

    if (sendInApp) {
      try {
        await this.inApp.create(userId, title, message, type ?? 'general', metadata ?? null)
      } catch (error) {
        inAppFailures.push('in_app')
        this.logger.error(
          `Job ${job.id}: in-app notification failed for user ${userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    const requiresEmail =
      sendEmail || sendVerificationEmail || sendPasswordResetEmail || sendCredentialsEmail

    if (requiresEmail && emailFailures.length > 0) {
      throw new Error(`Email delivery failed: ${emailFailures.join(', ')}`)
    }

    if (sendInApp && !requiresEmail && inAppFailures.length > 0) {
      throw new Error(`In-app delivery failed: ${inAppFailures.join(', ')}`)
    }

    if (delivery === NotificationDelivery.BOTH && inAppFailures.length > 0) {
      this.logger.warn(
        `Job ${job.id}: email sent but in-app notification failed for user ${userId}`,
      )
    }
  }
}
