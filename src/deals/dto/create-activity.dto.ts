import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class CreateActivityDto {
  @ApiProperty({
    description: 'Activity name',
    example: 'STEM Workshop',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @Length(2, 255)
  name: string
}
