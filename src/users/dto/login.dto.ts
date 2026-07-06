import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsPhoneNumber, IsString, Length, Matches } from 'class-validator'

export class LoginDto {
  @ApiProperty({
    example: '+2015013657687',
  })
  @Transform(({ value }: { value: string }) => value.replace(/[\s\-()]/g, ''))
  @IsPhoneNumber()
  phone: string

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
}
