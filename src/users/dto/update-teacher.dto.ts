import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, Length } from 'class-validator'

export class UpdateTeacherDto {
  @ApiPropertyOptional({ example: 'Sara Ahmed' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => value?.trim())
  name?: string

  @ApiPropertyOptional({ example: 'KG Teacher' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  jobTitle?: string
}
