import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LookupOptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty()
  label: string

  @ApiPropertyOptional()
  description?: string
}
