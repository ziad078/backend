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
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { EvaluationsService } from './evaluations.service'
import { SaveProgressDto } from './dto/save-progress.dto'
import { SubmitAttemptDto } from './dto/submit-attempt.dto'
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum'
import { EvaluationSlotService } from './services/evaluation-slot.service'
import { ListAttemptsQueryDto } from './dto/list-attempts-query.dto'
import { RequestExtraAttemptDto } from './dto/request-extra-attempt.dto'

type JwtRequestUser = {
  userId: string
  roles: { name: UserRole }[]
  email?: string
  phone?: string
}

@ApiTags('evaluation-attempts')
@ApiBearerAuth()
@Controller('attempts')
export class AttemptsController {
  constructor(
    private readonly service: EvaluationsService,
    private readonly slots: EvaluationSlotService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Admin list/filter evaluation attempts' })
  getAttemptsForAdmin(
    @Query() query: ListAttemptsQueryDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getAttemptsForAdmin(
      {
        userId: user.userId,
        roles: user.roles.map((r) => r.name),
      },
      {
        status: query.status,
        evaluationId: query.evaluationId,
        childId: query.childId,
        organizationChildId: query.organizationChildId,
        privateChildId: query.privateChildId,
      },
      query,
    )
  }

  @Roles(UserRole.PARENT, UserRole.TEACHER, UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('child/:childId')
  @ApiOperation({ summary: 'Get evaluation attempts for a child' })
  getAttemptsForChild(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Query() query: ListAttemptsQueryDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser

    return this.service.getAttemptsForChild(childId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    }, query)
  }

  @Roles(UserRole.PARENT)
  @Get(':childId/state')
  @ApiOperation({
    summary: 'Get the evaluation entitlement state for a child (private or organization)',
  })
  getChildState(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.getChildEvaluationState(childId, user.userId)
  }

  @Roles(UserRole.PARENT)
  @Post(':childId/start')
  @ApiOperation({
    summary: 'Open the main free evaluation slot for a private child',
  })
  startPrivateMain(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.startMainSlot(childId, user.userId)
  }

  @Roles(UserRole.PARENT)
  @Post(':childId/retake')
  @ApiOperation({
    summary: 'Open the free retake slot for a private child',
  })
  requestPrivateRetake(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.requestRetake(childId, user.userId)
  }

  @Roles(UserRole.PARENT)
  @Post(':childId/request-extra')
  @ApiOperation({
    summary: 'Request one or more paid extra evaluation attempts',
  })
  requestPrivateExtra(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Body() dto: RequestExtraAttemptDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.slots.requestExtraAttempt(childId, user.userId, dto.quantity ?? 1)
  }

  @Roles(UserRole.PARENT, UserRole.TEACHER, UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Patch(':id/save')
  @ApiOperation({ summary: 'Save evaluation attempt progress' })
  save(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SaveProgressDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.service.saveProgress(attemptId, dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.PARENT, UserRole.TEACHER, UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit evaluation attempt final answers' })
  submit(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SubmitAttemptDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser
    return this.service.submitAttempt(attemptId, dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.PARENT, UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER)
  @Get(':id')
  @ApiOperation({ summary: 'Get evaluation attempt details' })
  get(@Param('id', new ParseUUIDPipe()) attemptId: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.service.getAttempt(attemptId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an evaluation attempt' })
  approve(@Param('id', new ParseUUIDPipe()) attemptId: string, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.service.approveAttempt(attemptId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    })
  }
}
