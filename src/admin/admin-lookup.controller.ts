import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { SearchPaginationQueryDto } from 'src/common/dto/search-pagination-query.dto'
import { AdminLookupService } from './admin-lookup.service'
import { LookupChildrenQueryDto } from './dto/lookup-children-query.dto'

@ApiTags('admin-lookup')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/lookup')
export class AdminLookupController {
  constructor(private readonly lookupService: AdminLookupService) {}

  @Get('users')
  @ApiOperation({ summary: 'Search users for admin pickers' })
  lookupUsers(@Query() query: SearchPaginationQueryDto) {
    return this.lookupService.lookupUsers(query)
  }

  @Get('evaluations')
  @ApiOperation({ summary: 'Search evaluations for admin pickers' })
  lookupEvaluations(@Query() query: SearchPaginationQueryDto) {
    return this.lookupService.lookupEvaluations(query)
  }

  @Get('children')
  @ApiOperation({ summary: 'Search children for admin pickers' })
  lookupChildren(@Query() query: LookupChildrenQueryDto) {
    return this.lookupService.lookupChildren(query)
  }
}
