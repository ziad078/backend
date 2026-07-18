import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsPhoneNumber, IsString, Length } from 'class-validator'

export class CreateTeacherDto {
  @ApiProperty({ example: 'Sara Ahmed' })
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => value.trim())
  name: string

  @ApiProperty({ example: 'teacher@school.com' })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email: string

  @ApiProperty({ example: '+966501234567' })
  @Transform(({ value }: { value: string }) => value.replace(/[\s\-()]/g, ''))
  @IsPhoneNumber()
  phone: string

  @ApiProperty({ example: 'KG Teacher' })
  @IsString()
  @Length(2, 100)
  jobTitle: string
}
