import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common'
import { ChildrenService } from './children.service'
import { CreateChildDto } from './dto/create-child.dto'
import { UpdateChildDto } from './dto/update-child.dto'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from 'src/users/decorators/role.decorator'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'

@ApiTags('children')
@ApiBearerAuth()
@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.TEACHER)
  @Post()
  @ApiOperation({
    summary: 'add child with auto parent account creation (organization members)',
  })
  create(
    @Body()
    createChildDto: CreateChildDto,
    @Req()
    req: AuthRequest,
  ) {
    console.log('hi', createChildDto)
    return this.childrenService.createChild(createChildDto, req.user)
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all children (admin)' })
  @Get('all')
  findAll() {
    return this.childrenService.findAll()
  }

  @Roles(UserRole.ADMIN, UserRole.PARENT)
  @Get()
  @ApiOperation({
    summary: 'Get all children for specific user (self or admin)',
  })
  findByUser(@Query('userId', new ParseUUIDPipe()) userId: string, @Req() req: AuthRequest) {
    return this.childrenService.findByUser(userId, req.user)
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN, UserRole.TEACHER)
  @Get('organization/:orgId')
  @ApiOperation({ summary: 'Get all children for specific org' })
  findAllByOrganization(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: AuthRequest,
  ) {
    return this.childrenService.findAllByOrganization(orgId, req.user)
  }

  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER)
  @Get(':id')
  @ApiOperation({ summary: 'Get child data' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    return this.childrenService.findOne(id, req.user)
  }

  @Roles(UserRole.PARENT, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update child' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateChildDto: UpdateChildDto,
    @Req() req: AuthRequest,
  ) {
    return this.childrenService.update(id, updateChildDto, req.user)
  }

  @Roles(UserRole.PARENT, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete child' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    return this.childrenService.remove(id, req.user)
  }
}
