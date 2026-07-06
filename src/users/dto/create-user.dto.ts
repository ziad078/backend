import { Transform } from 'class-transformer'
import { IsEmail, IsPhoneNumber, IsString, Length, Matches } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => value.trim())
  name: string

  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email: string

  @IsString()
  @Length(8, 100, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string
  @IsPhoneNumber()
  phone: string
}
