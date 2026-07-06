import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Notification } from '../entities/notification.entity'

@Injectable()
export class InAppProvider {
  private readonly logger = new Logger(InAppProvider.name)

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
    type = 'general',
    metadata: Record<string, unknown> | null = null,
  ): Promise<Notification> {
    try {
      const row = this.notifications.create({
        userId,
        title,
        message,
        type,
        metadata,
        isRead: false,
      })

      return await this.notifications.save(row)
    } catch (err) {
      this.logger.error(
        `Failed to persist in-app notification for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      throw err
    }
  }
}
