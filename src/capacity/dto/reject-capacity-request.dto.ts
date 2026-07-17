import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class RejectCapacityRequestDto {
  @ApiPropertyOptional({
    description: 'Optional reason shown to the parent explaining the rejection',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
