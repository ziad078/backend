import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { Roles } from 'src/users/decorators/role.decorator'
import { EvaluationSlotService } from './services/evaluation-slot.service'

type JwtRequestUser = {
  userId: string
  roles: { name: UserRole }[]
}

@ApiTags('admin-private-attempts')
@ApiBearerAuth()
@Controller('admin/attempts')
export class AdminPrivateAttemptsController {
  constructor(private readonly slots: EvaluationSlotService) {}

  @Roles(UserRole.ADMIN)
  @Get('extra-requests')
  @ApiOperation({
    summary: 'List pending paid extra evaluation attempt requests',
  })
  listExtraRequests() {
    return this.slots.listExtraAttemptRequests()
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve an extra private evaluation attempt (creates checkout session)',
  })
  approve(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.adminApproveExtraAttempt(id, user.userId)
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending extra private evaluation attempt request',
  })
  reject(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.adminRejectExtraAttempt(id, user.userId)
  }
}
