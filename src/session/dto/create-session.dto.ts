import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string

  @IsString()
  @IsNotEmpty()
  refreshToken: string

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  device?: string

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  ip?: string
}
