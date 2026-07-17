import { ApiProperty } from '@nestjs/swagger'
import { IsPhoneNumber, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

export class SearchParentByPhoneDto {
  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @IsPhoneNumber()
  @Transform(({ value }: { value?: string }) => value?.trim())
  phone: string
}
