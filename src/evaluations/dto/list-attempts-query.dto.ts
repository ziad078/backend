import { IsEnum, IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto'
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum'

export class ListAttemptsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EvaluationAttemptStatus })
  @IsOptional()
  @IsEnum(EvaluationAttemptStatus)
  status?: EvaluationAttemptStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluationId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childId?: string
}
