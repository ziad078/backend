import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RecordDealAttendanceDto {
  @ApiProperty({ description: 'Number of students who attended' })
  @IsInt()
  @Min(0)
  studentsAttended: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}

export class RejectProposalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}
