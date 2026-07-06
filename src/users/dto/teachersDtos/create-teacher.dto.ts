import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { BaseSignupDto } from '../base-signup.dto'

export class CreateTeacherDto extends BaseSignupDto {
  @ApiProperty({
    example: 'KG Teahcer',
  })
  @IsString()
  @Length(2, 100)
  jobTitle: string
}
