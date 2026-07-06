import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthRequest } from 'src/common/interfaces/auth-request.interface'

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>()
    return req.user.userId === req.params.userId
  }
}
