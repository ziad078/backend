import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { PaginationQueryDto } from './pagination-query.dto'

export class SearchPaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search term' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string
}
