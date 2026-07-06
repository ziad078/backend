import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { ChildrenService } from './children.service'
import { CreateChildByParentDto } from './dto/create-child-by-parent.dto'

type JwtRequestUser = {
  userId: string
  roles: { name: UserRole }[]
}

@ApiTags('parent-children')
@ApiBearerAuth()
@Controller('parent')
export class ParentChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Roles(UserRole.PARENT)
  @Post('children')
  @ApiOperation({ summary: 'Add a private (non-institutional) child' })
  create(@Body() dto: CreateChildByParentDto, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.childrenService.createChildByParent(user.userId, dto)
  }

  @Roles(UserRole.PARENT)
  @Get('children')
  @ApiOperation({ summary: 'List private children for the current parent' })
  list(@Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.childrenService.findPrivateChildrenForParent(user.userId)
  }

  @Roles(UserRole.PARENT)
  @Get('org-children')
  @ApiOperation({
    summary: 'List organization children for the current parent',
  })
  listOrgChildren(@Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser
    return this.childrenService.findOrgChildrenForParent(user.userId)
  }
}
