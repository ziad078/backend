import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { LoginDto } from '../dto/login.dto'
import { JwtService } from '@nestjs/jwt'
import { SessionService } from 'src/session/session.service'
import bcrypt from 'bcrypt'
import { BeneficiariesSignupDto } from '../dto/beneficiaries/beneficiaries-signup.dto'
import { EnrichersSignupDto } from '../dto/enrichers/enrichers-signup.dto'
import { ParentSignupDto } from '../dto/parent-signup.dto'
import { Public } from '../decorators/public.decorator'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { AuthProvider, TokenPayload } from '../services/auth.provider'
import { UsersService } from '../services/users.service'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthProvider,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly usersService: UsersService,
  ) {}
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.phone, dto.password)

    if (!user) throw new UnauthorizedException()

    return this.authService.login(user)
  }
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('beneficiaries-signup')
  async beneficiariesSiginup(@Body() dto: BeneficiariesSignupDto) {
    const alreadyExists = await this.authService.isAlreadyExits(dto.phone, dto.email)
    if (alreadyExists) {
      throw new ConflictException('User already exists')
    }
    return this.authService.beneficiariesSignup(dto)
  }
  @Public()
  @Post('enrichers-signup')
  async enrichersSignup(@Body() dto: EnrichersSignupDto) {
    const alreadyExists = await this.authService.isAlreadyExits(dto.phone, dto.email)
    if (alreadyExists) {
      throw new ConflictException('User already exists')
    }
    return this.authService.enrichersSignup(dto)
  }
  @Public()
  @Post('parent-signup')
  async parentSignup(@Body() dto: ParentSignupDto) {
    const alreadyExists = await this.authService.isAlreadyExits(dto.phone, dto.email)
    if (alreadyExists) {
      throw new ConflictException('User already exists')
    }
    return this.authService.parentSignup(dto)
  }
  @Public()
  @Post('refresh')
  async refresh(@Body('token') token?: string) {
    if (!token) {
      throw new UnauthorizedException('Refresh token missing')
    }
    try {
      const payload = this.jwtService.verify<TokenPayload>(token)
      const sessions = await this.sessionsService.findValidSessions(payload.sub)
      const matchedSession = (
        await Promise.all(
          sessions.map(async (session) => ({
            session,
            valid: await bcrypt.compare(token, session.refreshTokenHash),
          })),
        )
      ).find((entry) => entry.valid)?.session

      if (!matchedSession) {
        await this.sessionsService.deleteAllUserSessions(payload.sub)
        throw new UnauthorizedException('Session compromised')
      }

      const user = await this.usersService.findById(payload.sub)

      if (!user) throw new UnauthorizedException()

      await this.sessionsService.deleteSession(matchedSession.id)

      return this.authService.login(user)
    } catch {
      throw new BadRequestException('Invalid or expired token')
    }
  }

  @Delete('logout/:sessionId')
  async logout(@Param('sessionId', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const session = await this.sessionsService.findOne(id)
    if (!session || session.userId !== req.user.userId) {
      throw new ForbiddenException('Cannot logout this session')
    }
    await this.sessionsService.deleteSession(id)
    return { message: 'Logged out', statusCode: 200 }
  }
  @Delete('logout-all')
  async logoutAll(@Req() req: AuthRequest) {
    await this.sessionsService.deleteAllUserSessions(req.user.userId)
  }

  @Public()
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token)
  }
}
