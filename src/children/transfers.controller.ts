import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from 'src/users/decorators/role.decorator'
import { ApproveTransferDto, RequestTransferDto } from './dto/transfer-request.dto'
import { TransferService } from './transfer.service'
import { ListTransferRequestsDto } from './dto/list-transfer-requests.dto'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'

@ApiTags('child-transfers')
@ApiBearerAuth()
@Controller('child-transfers')
export class TransfersController {
  constructor(private readonly transferService: TransferService) {}

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Request moving a child to another organization' })
  async requestTransfer(@Body() dto: RequestTransferDto, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.transferService.requestTransfer(
      dto.childId,
      dto.childType || 'organization',
      dto.toOrganizationId,
      user.userId,
      user.email || '',
      (user.roles || []).map((r) => r.name),
    )
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a child transfer and assign a class' })
  async approveTransfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveTransferDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.transferService.approveTransfer(
      id,
      dto.classId,
      user.userId,
      user.email || '',
      (user.roles || []).map((r) => r.name),
    )
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a child transfer request' })
  async rejectTransfer(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.transferService.rejectTransfer(
      id,
      user.userId,
      user.email || '',
      (user.roles || []).map((r) => r.name),
    )
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List transfer requests' })
  getTransferRequests(@Query() query: ListTransferRequestsDto) {
    return this.transferService.getTransferRequests(query)
  }
}
