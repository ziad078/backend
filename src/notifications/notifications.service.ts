import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import type { Queue, JobOptions, Job } from 'bull'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Notification } from './entities/notification.entity'
import { User } from 'src/users/entities/user.entity'
import { NotificationDelivery } from './enums/notification-delivery.enum'
import type { NotificationSendJobPayload } from './interfaces/notification-job.interface'
import { DispatchNotificationDto } from './dto/dispatch-notification.dto'
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto'
import { buildPaginationMeta } from 'src/common/dto/pagination-query.dto'

const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: Number(process.env.NOTIFICATION_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.NOTIFICATION_JOB_BACKOFF_MS ?? 3000),
  },
  removeOnComplete: Number(process.env.NOTIFICATION_JOB_REMOVE_ON_COMPLETE ?? 500),
  removeOnFail: Number(process.env.NOTIFICATION_JOB_REMOVE_ON_FAIL ?? 200),
}

/** Email must not be retried automatically — retries can duplicate outbound mail. */
const EMAIL_JOB_OPTIONS: JobOptions = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 1,
}

const EMAIL_DELIVERIES = new Set<NotificationDelivery>([
  NotificationDelivery.EMAIL,
  NotificationDelivery.BOTH,
  NotificationDelivery.VERIFY_EMAIL,
  NotificationDelivery.RESET_PASSWORD,
  NotificationDelivery.ACCOUNT_CREDENTIALS,
])

function jobOptionsForDelivery(delivery: NotificationDelivery, extra?: JobOptions): JobOptions {
  const base = EMAIL_DELIVERIES.has(delivery) ? EMAIL_JOB_OPTIONS : DEFAULT_JOB_OPTIONS
  return { ...base, ...extra }
}

function dedupeJobId(delivery: NotificationDelivery, userId: string): string | undefined {
  switch (delivery) {
    case NotificationDelivery.VERIFY_EMAIL:
      return `verify_email:${userId}`
    case NotificationDelivery.RESET_PASSWORD:
      return `reset_password:${userId}`
    case NotificationDelivery.ACCOUNT_CREDENTIALS:
      return `account_credentials:${userId}`
    default:
      return undefined
  }
}

export type EnqueueVerificationEmailResult = {
  queued: boolean
  reason?: 'already_verified' | 'already_queued'
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectQueue('notifications')
    private readonly queue: Queue<NotificationSendJobPayload>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private async resolveUserEmail(userId: string, email?: string): Promise<string> {
    const trimmed = email?.trim()
    if (trimmed) return trimmed

    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'email'],
    })

    if (!user?.email?.trim()) {
      throw ApiException.badRequest(ApiErrorCodes.NOTIFICATION_EMAIL_REQUIRED)
    }

    return user.email.trim()
  }

  private async isPendingJob(jobId: string): Promise<boolean> {
    const existing: Job<NotificationSendJobPayload> | null = await this.queue.getJob(jobId)
    if (!existing) return false

    const state = await existing.getState()
    return state === 'waiting' || state === 'delayed' || state === 'active'
  }

  /**
   * Queue a verification email once per user while a send is pending.
   * Skips users who are already verified.
   */
  async enqueueVerificationEmail(
    userId: string,
    email?: string,
  ): Promise<EnqueueVerificationEmailResult> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isEmailVerified'],
    })

    if (!user) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    if (user.isEmailVerified) {
      this.logger.log(`Skipping verification email: user ${userId} is already verified`)
      return { queued: false, reason: 'already_verified' }
    }

    const jobId = dedupeJobId(NotificationDelivery.VERIFY_EMAIL, userId)!
    if (await this.isPendingJob(jobId)) {
      this.logger.log(`Verification email deduped for user ${userId} (job already queued)`)
      return { queued: false, reason: 'already_queued' }
    }

    const resolvedEmail = await this.resolveUserEmail(userId, email ?? user.email)

    await this.queue.add(
      'send',
      {
        delivery: NotificationDelivery.VERIFY_EMAIL,
        userId,
        email: resolvedEmail,
        title: '',
        message: '',
        type: 'verify-email',
      },
      jobOptionsForDelivery(NotificationDelivery.VERIFY_EMAIL, { jobId }),
    )

    return { queued: true }
  }

  /**
   * Enqueue a notification for asynchronous delivery (email, in-app, or both).
   */
  async enqueue(payload: NotificationSendJobPayload, jobOptions?: JobOptions): Promise<void> {
    if (payload.delivery === NotificationDelivery.VERIFY_EMAIL) {
      await this.enqueueVerificationEmail(payload.userId, payload.email)
      return
    }

    const needsEmail =
      payload.delivery === NotificationDelivery.EMAIL ||
      payload.delivery === NotificationDelivery.BOTH ||
      payload.delivery === NotificationDelivery.RESET_PASSWORD

    if (needsEmail && !payload.email?.trim()) {
      payload.email = await this.resolveUserEmail(payload.userId)
    }

    const jobId = dedupeJobId(payload.delivery, payload.userId)
    if (jobId && (await this.isPendingJob(jobId))) {
      this.logger.log(
        `Notification deduped (${payload.delivery}) for user ${payload.userId} (job already queued)`,
      )
      return
    }

    await this.queue.add('send', payload, {
      ...jobOptionsForDelivery(payload.delivery),
      ...jobOptions,
      ...(jobId ? { jobId } : {}),
    })
  }

  /**
   * Resolve recipient email when needed, then enqueue.
   */
  async dispatch(dto: DispatchNotificationDto): Promise<{ jobId: string | number }> {
    const needsEmail =
      dto.delivery === NotificationDelivery.EMAIL || dto.delivery === NotificationDelivery.BOTH

    let email = dto.email
    if (needsEmail && !email) {
      const user = await this.users.findOne({
        where: { id: dto.userId },
        select: ['id', 'email'],
      })
      if (!user) {
        throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
      }
      email = user.email
    }

    if (dto.delivery === NotificationDelivery.EMAIL && !email?.trim()) {
      throw ApiException.badRequest(ApiErrorCodes.NOTIFICATION_EMAIL_REQUIRED)
    }

    if (dto.delivery === NotificationDelivery.BOTH && !email?.trim()) {
      throw ApiException.badRequest(ApiErrorCodes.NOTIFICATION_EMAIL_REQUIRED)
    }

    const payload: NotificationSendJobPayload = {
      delivery: dto.delivery,
      userId: dto.userId,
      email,
      title: dto.title,
      message: dto.message,
      type: dto.type ?? 'general',
      metadata: dto.metadata ?? null,
    }

    const job = await this.queue.add('send', payload, jobOptionsForDelivery(dto.delivery))
    this.logger.log(`Queued notification job ${job.id} (${dto.delivery}) for user ${dto.userId}`)
    return { jobId: job.id }
  }

  async listForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<{
    data: Array<{
      id: string
      userId: string
      title: string
      message: string
      type: string
      metadata: Record<string, unknown> | null
      isRead: boolean
      createdAt: Date
    }>
    meta: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const qb = this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    if (query.unreadOnly) {
      qb.andWhere('n.isRead = false')
    }

    if (query.type) {
      qb.andWhere('n.type = :type', { type: query.type })
    }

    const [rows, total] = await qb.getManyAndCount()

    return {
      data: rows.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
        metadata: n.metadata,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      meta: buildPaginationMeta(page, limit, total),
    }
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notifications.count({
      where: { userId, isRead: false },
    })
    return { count }
  }

  async markAsRead(userId: string, id: string): Promise<void> {
    const res = await this.notifications
      .createQueryBuilder()
      .update()
      .set({ isRead: true })
      .where('id = :id', { id })
      .andWhere('"userId" = :userId', { userId })
      .execute()

    if (!res.affected) {
      throw ApiException.notFound(ApiErrorCodes.NOTIFICATION_NOT_FOUND)
    }
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const res = await this.notifications
      .createQueryBuilder()
      .update()
      .set({ isRead: true })
      .where('"userId" = :userId', { userId })
      .andWhere('isRead = false')
      .execute()
    return { updated: res.affected ?? 0 }
  }
}
