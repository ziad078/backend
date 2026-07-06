import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuditLoggingService } from '../services/audit-logging.service'
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator'
import { AuthRequest } from '../interfaces/auth-request.interface'
import { hasRole } from '../utils/has-role.util'
import { UserRole } from '../enums/role.enum'

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditLogMetadata>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!auditMetadata) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<AuthRequest>()

    return next.handle().pipe(
      tap(async (data) => {
        if (!request.user) {
          return
        }

        const userRole =
          request.user.roles.length > 0 ? request.user.roles[0].name : UserRole.PARENT

        const entityId = auditMetadata.getEntityId
          ? auditMetadata.getEntityId(data || request.body || request.params)
          : request.params.id || data?.id || ''

        const oldValue = auditMetadata.getOldValue ? auditMetadata.getOldValue(data) : null

        const newValue = auditMetadata.getNewValue
          ? auditMetadata.getNewValue(data || request.body)
          : request.body || data

        await this.auditLoggingService.log({
          userId: request.user.userId,
          userEmail: request.user.email,
          userRole,
          action: auditMetadata.action,
          entityType: auditMetadata.entityType,
          entityId,
          oldValue,
          newValue,
          request,
        })
      }),
    )
  }
}
