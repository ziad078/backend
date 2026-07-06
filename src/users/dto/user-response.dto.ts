import { Role } from '../entities/user-roles.entity'

export interface IUserResponseDto {
  id: string
  name: string
  email: string
  isEmailVerified: boolean
  phone: string
  isPhoneVerified: boolean
  roles: Role[]
}
