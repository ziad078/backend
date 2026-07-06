import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateClassDto {
  @ApiProperty({ example: 'class-name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'Grade ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  gradeId: string

  @ApiPropertyOptional({
    description: 'Teacher assigned to this class',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string
}
