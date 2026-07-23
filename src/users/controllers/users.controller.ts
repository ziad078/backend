import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Post,
  Patch,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common'
import { UserRole } from 'src/common/enums/role.enum'
import { TeachersProvider } from '../services/teachers.provider'
import { Roles } from '../decorators/role.decorator'
import { UsersService } from '../services/users.service'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { hasRole } from 'src/common/utils/has-role.util'
import { ChangePasswordDto } from '../dto/change-password.dto'
import { AuthProvider } from '../services/auth.provider'
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly teachersProvider: TeachersProvider,
    private readonly authProvider: AuthProvider,
  ) {}

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }

  @Roles(UserRole.ADMIN)
  @Post('seed-roles')
  seedRoles() {
    return this.usersService.seedRoles()
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Roles(UserRole.ADMIN)
  @Get('roles')
  findUsersByRoles() {
    return this.usersService.findUsersByRoles()
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('organization-owner/:id')
  getOrganizationOwner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getOrganizationOwner(id)
  }

  @Get('me')
  getMe(@Req() req: AuthRequest) {
    return this.usersService.findById(req.user.userId)
  }

  @Patch('me/password')
  changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.authProvider.changePassword(req.user.userId, dto.currentPassword, dto.newPassword)
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const isAdmin = hasRole(req.user.roles, UserRole.ADMIN)
    if (!isAdmin && req.user.userId !== id) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }
    return this.usersService.findById(id)
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.remove(id)
  }

  // @Post('teachers')
  // createTeacher(@Body() createTeacherDto: CreateTeacherDto) {
  //   return this.teachersProvider.create(createTeacherDto);
  // }
}
