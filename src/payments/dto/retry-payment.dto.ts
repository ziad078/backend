import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class RetryPaymentDto {
  @ApiPropertyOptional({ description: 'Optional note for audit logs' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
