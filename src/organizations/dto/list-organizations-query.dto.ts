import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { SearchPaginationQueryDto } from 'src/common/dto/search-pagination-query.dto'

export class ListOrganizationsQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus
}
