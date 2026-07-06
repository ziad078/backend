import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsString, Length, IsEmail, Matches, IsPhoneNumber } from 'class-validator'

export class BaseSignupDto {
  @ApiProperty({
    example: 'ziad user',
  })
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => value.trim())
  name: string

  @ApiProperty({
    example: 'ziadzayd79@gmail.com',
  })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email: string

  @ApiProperty({
    example: '550e8AEd@400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @Length(8, 100, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string

  @ApiProperty({
    example: '+201503657687',
  })
  @Transform(({ value }: { value: string }) => value.replace(/[\s\-()]/g, ''))
  @IsPhoneNumber()
  phone: string
}
