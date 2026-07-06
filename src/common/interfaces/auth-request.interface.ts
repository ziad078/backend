import { Request } from 'express'
import { JwtRequestUser } from './jwt-request-user.interface'

export interface AuthRequest extends Request {
  user: JwtRequestUser
}
