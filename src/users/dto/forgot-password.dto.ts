import { IsPhoneNumber } from 'class-validator'

export class ForgotPasswordDto {
  @IsPhoneNumber()
  phone: string
}
