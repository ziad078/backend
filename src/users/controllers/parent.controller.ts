import { Controller, Get, Query } from '@nestjs/common'
import { ParentsServices } from '../services/parents.service'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from '../decorators/role.decorator'

@ApiTags('parents')
@ApiBearerAuth()
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsServices: ParentsServices) {}

  @ApiOperation({ summary: 'Find parent by phone' })
  @ApiResponse({ status: 200, description: 'Parent found successfully' })
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('search')
  findParentByPhone(@Query('phone') phone: string) {
    return this.parentsServices.findParentByPhone(phone)
  }
}
