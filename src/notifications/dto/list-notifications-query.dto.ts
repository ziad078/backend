import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @ApiPropertyOptional({
    description: 'When true, only unread notifications are returned',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    return undefined
  })
  @IsBoolean()
  unreadOnly?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string
}
