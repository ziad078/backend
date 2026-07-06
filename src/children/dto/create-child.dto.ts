import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
  IsNotEmptyObject,
  IsEmail,
  IsPhoneNumber,
  Length,
} from 'class-validator'
import { Gender } from 'src/common/enums/gender.enum'
import { IsValidBirthDate } from 'src/common/validators/birth-date.validator'
import { BaseSignupDto } from 'src/users/dto/base-signup.dto'
import { Transform, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateChildDto {
  @ApiProperty({
    example: 'child-name',
  })
  @IsString()
  name: string

  @ApiProperty({
    example: '2007-05-21',
    format: 'date',
  })
  @IsDateString()
  @IsValidBirthDate()
  birthDate: Date

  @ApiProperty({
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender: Gender

  @ApiProperty({
    description: 'class ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsUUID()
  classId: string

  @ApiProperty({ example: '+201503657687' })
  @IsPhoneNumber()
  parentPhone: string

  @ApiProperty({ example: 'parent@example.com', required: false })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value?: string }) => (value ? value.toLowerCase().trim() : value))
  parentEmail?: string

  @ApiProperty({ example: 'Parent Name', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value?: string }) => value?.trim())
  parentName?: string
}

export class CreateChildWithParentDto {
  @ApiProperty({ type: CreateChildDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateChildDto)
  child: CreateChildDto

  @ApiProperty({ type: BaseSignupDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => BaseSignupDto)
  parent: BaseSignupDto
}
