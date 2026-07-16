import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { AuditAction } from '../enums/audit-action.enum'
import { PaginationQueryDto } from './pagination-query.dto'

export class ListAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction
}
