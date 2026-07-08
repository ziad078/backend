import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { OrganizationsService } from './organizations.service'
import { UpdateOrganizationDto } from './dto/update-organization.dto'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { OrganizationStatusQueryDto } from './dto/organization-status-query.dto'
import { RejectOrganizationDto } from './dto/reject-organization.dto'
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { hasRole } from 'src/common/utils/has-role.util'

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Roles(UserRole.ADMIN)
  @Get('pending')
  @ApiOperation({ summary: 'List pending organizations (admin)' })
  findPending() {
    return this.organizationsService.findPending()
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List organizations, optionally filtered by status (admin)' })
  findAll(@Query() query: OrganizationStatusQueryDto) {
    return this.organizationsService.findAll(query.status)
  }

  @Roles(UserRole.ORGANIZATIONOWNER)
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated organization owner organization' })
  findMine(@Req() req: AuthRequest) {
    return this.organizationsService.findByOwnerResponse(req.user.userId)
  }

  @Roles(UserRole.ADMIN, UserRole.PARENT)
  @Get('by-parent/:parentProfileId')
  @ApiOperation({ summary: 'Get organization linked to a parent profile' })
  findByParentProfile(@Param('parentProfileId', new ParseUUIDPipe()) parentProfileId: string) {
    return this.organizationsService.findByParent(parentProfileId)
  }

  @Get('owner/:ownerId')
  @ApiOperation({ summary: 'Get organization by owner id (admin or self)' })
  async findByOwner(
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
    @Req() req: AuthRequest,
  ) {
    const isAdmin = hasRole(req.user.roles, UserRole.ADMIN)
    if (!isAdmin && req.user.userId !== ownerId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You can only view your own organization')
    }
    return this.organizationsService.findByOwnerResponse(ownerId)
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending or rejected organization (admin)' })
  approve(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    return this.organizationsService.approve(id, req.user.userId)
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending or approved organization (admin)' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectOrganizationDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.reject(id, req.user.userId, dto.rejectionReason)
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER)
  @Get(':id')
  @ApiOperation({ summary: 'Get organization by id (admin or owner)' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthRequest) {
    const org = await this.organizationsService.findOneOrFail(id)
    this.organizationsService.assertCanAccessOrganization(org, req.user)
    return this.organizationsService.findOne(id)
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER)
  @ApiOperation({ summary: 'Update organization profile fields (admin or owner)' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto, req.user)
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization (admin)' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.organizationsService.remove(id)
  }
}
