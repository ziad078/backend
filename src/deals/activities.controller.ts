import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/common/enums/role.enum'
import { Roles } from 'src/users/decorators/role.decorator'
import { ActivitiesService } from './activities.service'
import { CreateActivityDto } from './dto/create-activity.dto'
import { UpdateActivityDto } from './dto/update-activity.dto'

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new activity' })
  create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(dto)
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER)
  @Get()
  @ApiOperation({ summary: 'Get all activities' })
  findAll() {
    return this.activitiesService.findAll()
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER)
  @Get('with-deals')
  @ApiOperation({ summary: 'Get all activities with deals' })
  findAllWithDeals() {
    return this.activitiesService.findAllWithDeals()
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER)
  @Get(':id')
  @ApiOperation({ summary: 'Get one activity by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.activitiesService.findOne(id)
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.TEACHER, UserRole.ENRICHER)
  @Get(':id/with-deals')
  @ApiOperation({ summary: 'Get one activity with its deals' })
  findOneWithDeals(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.activitiesService.findOneWithDeals(id)
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update activity' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.update(id, dto)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete activity' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.activitiesService.remove(id)
  }
}
