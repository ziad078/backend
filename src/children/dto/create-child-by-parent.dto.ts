import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsString, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { Gender } from 'src/common/enums/gender.enum'
import { IsValidBirthDate } from 'src/common/validators/birth-date.validator'

export class CreateChildByParentDto {
  @ApiProperty({ example: 'child-name' })
  @IsString()
  @Length(2, 120)
  @Transform(({ value }: { value?: string }) => value?.trim())
  name: string

  @ApiProperty({ example: '2007-02-28', format: 'date' })
  @IsDateString()
  @IsValidBirthDate()
  birthDate: Date

  @ApiProperty({ example: Gender.MALE })
  @IsEnum(Gender)
  gender: Gender
}
