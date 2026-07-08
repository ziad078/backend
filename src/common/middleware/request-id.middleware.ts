import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers['x-request-id'] as string | undefined
    const requestId =
      existingId && /^[a-zA-Z0-9-]{1,128}$/.test(existingId) ? existingId : `req_${randomUUID()}`

    ;(req as any).requestId = requestId
    res.setHeader('X-Request-ID', requestId)
    next()
  }
}
