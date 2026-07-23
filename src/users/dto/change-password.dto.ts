import { IsString, Length, Matches } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  @Length(1, 100)
  currentPassword: string

  @IsString()
  @Length(8, 100, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword: string
}
