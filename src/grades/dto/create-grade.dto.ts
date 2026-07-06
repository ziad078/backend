import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty, IsUUID } from 'class-validator'

export class CreateGradeDto {
  @ApiProperty({
    example: 'grade one',
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'organization ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsUUID()
  organizationId: string
}
