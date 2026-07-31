import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { NotificationsService } from './notifications.service'
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto'
import { DispatchNotificationDto } from './dto/dispatch-notification.dto'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from 'src/users/decorators/role.decorator'

type JwtRequestUser = {
  userId: string
  email: string
  roles: { name: string }[]
  phone: string
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('verify-email')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send verification email' })
  async verifyEmail(@Body() data: { email: string; userId: string }) {
    const result = await this.notificationsService.enqueueVerificationEmail(
      data.userId,
      data.email,
    )

    return {
      success: true,
      queued: result.queued,
      reason: result.reason,
      message: result.queued
        ? 'Verification email queued successfully'
        : 'Verification email was not queued',
    }
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  listMine(
    @Req() req: Request & { user: JwtRequestUser },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listForUser(req.user.userId, query)
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread in-app notification count' })
  unreadCount(@Req() req: Request & { user: JwtRequestUser }) {
    return this.notificationsService.unreadCount(req.user.userId)
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read for the current user',
  })
  markAllRead(@Req() req: Request & { user: JwtRequestUser }) {
    return this.notificationsService.markAllAsRead(req.user.userId)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notificationsService.markAsRead(req.user.userId, id)
  }

  @Roles(UserRole.ADMIN)
  @Post('dispatch')
  @ApiOperation({
    summary: 'Enqueue notification for a user (admin)',
    description:
      'Queues email, in-app, or both. Recipient email defaults to the user profile when email is involved.',
  })
  dispatch(@Body() dto: DispatchNotificationDto) {
    return this.notificationsService.dispatch(dto)
  }
}
