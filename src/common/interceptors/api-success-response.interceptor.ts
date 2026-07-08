import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { map, Observable } from 'rxjs'
import { ApiSuccessResponse } from '../interfaces/api-response.interface'
import { SKIP_RESPONSE_TRANSFORM_KEY } from '../decorators/skip-response-transform.decorator'

@Injectable()
export class ApiResponseSuccessIntercepter implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (skip) {
      return next.handle()
    }

    const response = context.switchToHttp().getResponse<Response>()
    const request = context.switchToHttp().getRequest<any>()

    return next.handle().pipe(
      map(
        (data: unknown): ApiSuccessResponse<unknown> => ({
          success: true as const,
          data,
          requestId: request.requestId ?? '',
          timestamp: new Date().toISOString(),
        }),
      ),
    )
  }
}
