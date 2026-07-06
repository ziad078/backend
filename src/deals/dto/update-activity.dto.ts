import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Length } from 'class-validator'

export class UpdateActivityDto {
  @ApiPropertyOptional({
    description: 'Activity name',
    example: 'Advanced STEM Workshop',
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string
}
