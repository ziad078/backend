import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { EnrichersService } from '../services/enrichers.service'
import { DealsService } from 'src/deals/deals.service'
import { Roles } from '../decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'

@ApiTags('enrichers (service provider)')
@ApiBearerAuth()
@Controller('enrichers')
export class EnrichersController {
  constructor(
    private readonly enrichersService: EnrichersService,
    private readonly dealsService: DealsService,
  ) {}

  @Roles(UserRole.ENRICHER)
  @Get('deals')
  @ApiOperation({ summary: 'List available open deals for providers' })
  listAvailableDeals() {
    return this.dealsService.listDeals('OPEN')
  }

  @Roles(UserRole.ENRICHER)
  @Get('deals/:dealId')
  @ApiOperation({ summary: 'Get deal details for provider' })
  getDeal(@Param('dealId', new ParseUUIDPipe()) dealId: string) {
    return this.dealsService.findOne(dealId)
  }

  @Roles(UserRole.ENRICHER)
  @Get('proposals')
  @ApiOperation({ summary: 'List my proposals' })
  listMyProposals(@Req() req: AuthRequest) {
    return this.dealsService.listMyProposals(req.user.userId)
  }
}
