import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class RequestExtraAttemptDto {
  @ApiPropertyOptional({
    description: 'Number of extra attempts to request (paid). Defaults to 1.',
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number
}
