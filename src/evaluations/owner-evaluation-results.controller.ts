import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { OwnerEvaluationResultsService } from './owner-evaluation-results.service'

type JwtRequestUser = {
  userId: string
  roles: { name: UserRole }[]
}

@ApiTags('owner-evaluation-results')
@ApiBearerAuth()
@Controller('evaluations/owner')
export class OwnerEvaluationResultsController {
  constructor(private readonly service: OwnerEvaluationResultsService) {}

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('filters')
  @ApiOperation({ summary: 'Get owner filters: classes and evaluations' })
  getFilters(@Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getFilters({
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('reports')
  @ApiOperation({ summary: 'Get owner evaluation report cards' })
  @ApiQuery({ name: 'evaluationId', required: false })
  getReports(@Req() req: AuthRequest, @Query('evaluationId') evaluationId?: string) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getReports(
      {
        userId: user.userId,
        roles: user.roles.map((r) => r.name),
      },
      { evaluationId },
    )
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('classes/:classId/evaluations/:evaluationId/summary')
  @ApiOperation({
    summary: 'Get owner class evaluation summary by class and evaluation',
  })
  getClassEvaluationSummary(
    @Param('classId', new ParseUUIDPipe()) classId: string,
    @Param('evaluationId', new ParseUUIDPipe()) evaluationId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getClassEvaluationSummary(classId, evaluationId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('classes/:classId/evaluations/:evaluationId/status')
  @ApiOperation({
    summary: 'Get owner class evaluation status by class and evaluation',
  })
  getClassEvaluationStatus(
    @Param('classId', new ParseUUIDPipe()) classId: string,
    @Param('evaluationId', new ParseUUIDPipe()) evaluationId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getClassEvaluationStatus(classId, evaluationId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Post('children/:childId/reminder')
  @ApiOperation({ summary: 'Send evaluation reminder to parent' })
  sendReminder(@Param('childId', new ParseUUIDPipe()) childId: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.sendReminder(childId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }
}
