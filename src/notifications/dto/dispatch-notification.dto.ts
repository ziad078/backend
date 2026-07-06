import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { NotificationDelivery } from '../enums/notification-delivery.enum'

export class DispatchNotificationDto {
  @ApiProperty({ enum: NotificationDelivery })
  @IsEnum(NotificationDelivery)
  delivery: NotificationDelivery

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string

  @ApiPropertyOptional({
    description:
      'Override recipient email. If omitted, the user profile email is used when email delivery is required.',
  })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title: string

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @MaxLength(10000)
  message: string

  @ApiPropertyOptional({ example: 'evaluation' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string

  @ApiPropertyOptional({
    description: 'Optional metadata for frontend navigation and context',
  })
  @IsOptional()
  metadata?: Record<string, unknown>
}
