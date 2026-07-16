import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { AuditLoggingService } from '../services/audit-logging.service'
import { ListAuditLogsDto } from '../dto/list-audit-logs.dto'

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLoggingService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List audit logs (admin only, paginated)' })
  list(@Query() query: ListAuditLogsDto) {
    return this.auditLogs.list(query)
  }
}
