import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Response } from 'express'
import { map, Observable } from 'rxjs'
import { ApiSuccessResponse } from '../interfaces/api-response.interface'

@Injectable()
export class ApiResponseSuccessIntercepter implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse<Response>()
    return next.handle().pipe(
      map(
        (data: unknown): ApiSuccessResponse<unknown> => ({
          success: true,
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
        }),
      ),
    )
  }
}
