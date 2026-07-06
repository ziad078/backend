import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue, JobOptions } from 'bull'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Notification } from './entities/notification.entity'
import { User } from 'src/users/entities/user.entity'
import { NotificationDelivery } from './enums/notification-delivery.enum'
import type { NotificationSendJobPayload } from './interfaces/notification-job.interface'
import { DispatchNotificationDto } from './dto/dispatch-notification.dto'
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto'

const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: Number(process.env.NOTIFICATION_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.NOTIFICATION_JOB_BACKOFF_MS ?? 3000),
  },
  removeOnComplete: Number(process.env.NOTIFICATION_JOB_REMOVE_ON_COMPLETE ?? 500),
  removeOnFail: Number(process.env.NOTIFICATION_JOB_REMOVE_ON_FAIL ?? 200),
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

  /**
   * Enqueue a notification for asynchronous delivery (email, in-app, or both).
   */
  async enqueue(payload: NotificationSendJobPayload, jobOptions?: JobOptions): Promise<void> {
    const needsEmail =
      payload.delivery === NotificationDelivery.EMAIL ||
      payload.delivery === NotificationDelivery.BOTH ||
      payload.delivery === NotificationDelivery.VERIFY_EMAIL

    if (needsEmail && !payload.email?.trim()) {
      const user = await this.users.findOne({
        where: { id: payload.userId },
        select: ['id', 'email'],
      })

      if (!user?.email) {
        throw new BadRequestException('Email is required for email notification delivery')
      }

      payload.email = user.email
    }

    await this.queue.add('send', payload, {
      ...DEFAULT_JOB_OPTIONS,
      ...jobOptions,
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
        throw new NotFoundException('User not found')
      }
      email = user.email
    }

    if (dto.delivery === NotificationDelivery.EMAIL && !email?.trim()) {
      throw new BadRequestException('Email is required for email delivery')
    }

    if (dto.delivery === NotificationDelivery.BOTH && !email?.trim()) {
      throw new BadRequestException(
        'Email is required for combined delivery when the user has no email on file',
      )
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

    const job = await this.queue.add('send', payload, DEFAULT_JOB_OPTIONS)
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
    meta: { page: number; limit: number; total: number; totalPages: number }
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
    const totalPages = Math.max(1, Math.ceil(total / limit))

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
      meta: { page, limit, total, totalPages },
    }
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notifications.count({
      where: { user: { id: userId }, isRead: false },
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
      throw new NotFoundException('Notification not found')
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
