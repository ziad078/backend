import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateEvaluationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  ageFrom?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  ageTo?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean
}
