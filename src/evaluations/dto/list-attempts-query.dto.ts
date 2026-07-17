import { IsEnum, IsOptional, IsUUID } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'

export class ListAttemptsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EvaluationAttemptStatus })
  @IsOptional()
  @IsEnum(EvaluationAttemptStatus)
  status?: EvaluationAttemptStatus

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  evaluationId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  childId?: string
}
