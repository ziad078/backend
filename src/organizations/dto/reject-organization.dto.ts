import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { Transform } from 'class-transformer'

export class RejectOrganizationDto {
  @ApiProperty({ example: 'Incomplete documentation provided' })
  @IsString()
  @Length(3, 500)
  @Transform(({ value }: { value?: string }) => value?.trim())
  rejectionReason: string
}
