import { Body, Controller, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { Roles } from 'src/users/decorators/role.decorator'
import { DealsService } from './deals.service'
import { UpdateProposalDto } from './dto/update-proposal.dto'

@ApiTags('proposals')
@ApiBearerAuth()
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly dealsService: DealsService) {}

  @Patch(':id')
  @Roles(UserRole.ENRICHER)
  @ApiOperation({ summary: 'Update proposal price before deal deadline' })
  updateProposal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProposalDto,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.updateProposal(id, dto, req.user)
  }
}
