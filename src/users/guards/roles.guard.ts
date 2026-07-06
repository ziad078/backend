import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from 'src/common/enums/role.enum'
import { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { ROLES_KEY } from '../decorators/role.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!roles?.length) return true

    const request = context.switchToHttp().getRequest<AuthRequest>()
    const user = request.user
    if (!user) return false
    return user.roles.some((role) => roles.includes(role.name))
  }
}
