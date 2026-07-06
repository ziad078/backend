import { Controller, Get, Post, Body, Patch, Param, ParseUUIDPipe, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { CapacityRequestService } from './capacity-request.service'
import { CreateCapacityRequestDto } from './dto/create-capacity-request.dto'
import { UpdateCapacityRequestDto } from './dto/update-capacity-request.dto'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { AuditLog } from 'src/common/decorators/audit-log.decorator'
import { AuditAction } from 'src/common/enums/audit-action.enum'

@ApiTags('capacity-requests')
@ApiBearerAuth()
@Controller('capacity-requests')
export class CapacityRequestController {
  constructor(private readonly capacityRequestService: CapacityRequestService) {}

  @Post()
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Create a capacity request (parent only)' })
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: 'CapacityRequest',
    getEntityId: (data) => data.id,
  })
  create(@Body() createDto: CreateCapacityRequestDto, @Req() req: AuthRequest) {
    return this.capacityRequestService.create(createDto, req.user, req)
  }

  @Get()
  @ApiOperation({ summary: 'List capacity requests' })
  findAll(@Req() req: AuthRequest) {
    return this.capacityRequestService.findAll(req.user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single capacity request' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.capacityRequestService.findOne(id, req.user)
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a capacity request (admin only)' })
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: 'CapacityRequest',
    getEntityId: (data) => data.id,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCapacityRequestDto,
    @Req() req: AuthRequest,
  ) {
    return this.capacityRequestService.update(id, updateDto, req.user, req)
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a capacity request (admin only)' })
  @AuditLog({
    action: AuditAction.APPROVE,
    entityType: 'CapacityRequest',
    getEntityId: (data) => data.id,
  })
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.capacityRequestService.approve(id, req.user, req)
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a capacity request (admin only)' })
  @AuditLog({
    action: AuditAction.REJECT,
    entityType: 'CapacityRequest',
    getEntityId: (data) => data.id,
  })
  reject(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.capacityRequestService.reject(id, req.user, req)
  }
}
