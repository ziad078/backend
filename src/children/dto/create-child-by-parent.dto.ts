import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsString } from 'class-validator'
import { Gender } from 'src/common/enums/gender.enum'
import { IsValidBirthDate } from 'src/common/validators/birth-date.validator'

export class CreateChildByParentDto {
  @ApiProperty({ example: 'child-name' })
  @IsString()
  name: string

  @ApiProperty({ example: '2007-02-28', format: 'date' })
  @IsDateString()
  @IsValidBirthDate()
  birthDate: Date

  @ApiProperty({ example: Gender.MALE })
  @IsEnum(Gender)
  gender: Gender
}
