import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from '../decorators/role.decorator'
import { TeachersProvider } from '../services/teachers.provider'
import { CreateTeacherDto } from '../dto/teachersDtos/create-teacher.dto'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { UpdateTeacherDto } from '../dto/update-teacher.dto'

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersServieces: TeachersProvider) {}

  @ApiOperation({ summary: 'Created new Teacher' })
  @ApiResponse({ status: 201, description: 'teacher created successfully' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createTeahcerDto: CreateTeacherDto, @Req() req: AuthRequest) {
    return this.teachersServieces.create(createTeahcerDto, req.user)
  }

  @ApiOperation({ summary: 'Update a teacher' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
    @Req() req: AuthRequest,
  ) {
    return this.teachersServieces.update(id, updateTeacherDto, req.user)
  }

  @ApiOperation({ summary: 'Get all teachers for organization' })
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN, UserRole.TEACHER)
  @Get('organization/:organizationId')
  findAllByOrganization(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() req: AuthRequest,
  ) {
    return this.teachersServieces.findAllByOrganization(organizationId, req.user)
  }

  @ApiOperation({ summary: 'Delete a teacher' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    return this.teachersServieces.remove(id, req.user)
  }
}
