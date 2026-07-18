import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'
import { SearchPaginationQueryDto } from 'src/common/dto/search-pagination-query.dto'

export enum ChildLookupType {
  ORGANIZATION = 'organization',
  PRIVATE = 'private',
  ALL = 'all',
}

export class LookupChildrenQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ChildLookupType, default: ChildLookupType.ALL })
  @IsOptional()
  @IsEnum(ChildLookupType)
  type?: ChildLookupType = ChildLookupType.ALL
}
