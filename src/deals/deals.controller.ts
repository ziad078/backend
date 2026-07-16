import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { Roles } from 'src/users/decorators/role.decorator'
import { CreateDealDto } from './dto/create-deal.dto'
import { CreateProposalDto } from './dto/create-proposal.dto'
import { RecordDealAttendanceDto, RejectProposalDto } from './dto/deal-lifecycle.dto'
import { DealsService } from './deals.service'

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a new deal' })
  createDeal(@Body() dto: CreateDealDto, @Req() req: AuthRequest) {
    return this.dealsService.createDeal(dto, req.user)
  }

  @Get()
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List deals' })
  listDeals(@Query('status') status?: string) {
    return this.dealsService.listDeals(status)
  }

  @Get(':dealId')
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get deal details' })
  getDeal(@Param('dealId', new ParseUUIDPipe()) dealId: string) {
    return this.dealsService.findOne(dealId)
  }

  @Get(':dealId/proposals')
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List proposals for a deal (org owner or admin)' })
  getProposals(@Param('dealId', new ParseUUIDPipe()) dealId: string, @Req() req: AuthRequest) {
    return this.dealsService.getProposalsForDeal(dealId, req.user)
  }

  @Post(':dealId/proposals')
  @Roles(UserRole.ENRICHER)
  @ApiOperation({ summary: 'Submit a proposal for a deal' })
  submitProposal(
    @Param('dealId', new ParseUUIDPipe()) dealId: string,
    @Body() dto: CreateProposalDto,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.submitProposal(dealId, dto, req.user)
  }

  @Post(':dealId/proposals/:proposalId/select')
  @Roles(UserRole.ORGANIZATIONOWNER)
  @ApiOperation({ summary: 'Select a winning proposal' })
  selectProposal(
    @Param('proposalId', new ParseUUIDPipe()) proposalId: string,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.selectProposal(proposalId, req.user)
  }

  @Post(':dealId/proposals/:proposalId/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin approve a selected proposal' })
  adminApproveProposal(
    @Param('proposalId', new ParseUUIDPipe()) proposalId: string,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.adminApproveProposal(proposalId, req.user)
  }

  @Post(':dealId/proposals/:proposalId/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin reject a selected proposal' })
  adminRejectProposal(
    @Param('proposalId', new ParseUUIDPipe()) proposalId: string,
    @Body() dto: RejectProposalDto,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.adminRejectProposal(proposalId, dto, req.user)
  }

  @Patch(':dealId/attendance')
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Record attendance for an executing deal' })
  recordAttendance(
    @Param('dealId', new ParseUUIDPipe()) dealId: string,
    @Body() dto: RecordDealAttendanceDto,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.recordDealAttendance(dealId, dto, req.user)
  }

  @Post(':dealId/close')
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Close a deal after attendance is recorded' })
  closeDeal(@Param('dealId', new ParseUUIDPipe()) dealId: string, @Req() req: AuthRequest) {
    return this.dealsService.closeDeal(dealId, req.user)
  }
}
