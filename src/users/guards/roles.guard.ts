import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from 'src/common/enums/role.enum'
import { AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { ROLES_KEY } from '../decorators/role.decorator'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

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
    if (!user) {
      throw ApiException.unauthorized(ApiErrorCodes.AUTH_UNAUTHORIZED, 'Authentication required')
    }

    const hasRole = user.roles.some((role) => roles.includes(role.name))
    if (!hasRole) {
      throw ApiException.forbidden(
        ApiErrorCodes.AUTH_FORBIDDEN,
        'Insufficient permissions',
        { requiredRoles: roles },
      )
    }

    return true
  }
}
