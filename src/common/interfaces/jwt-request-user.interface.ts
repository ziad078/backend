import { UserRole } from 'src/common/enums/role.enum'

export type JwtRequestUser = {
  userId: string
  email: string
  phone: string
  roles: { name: UserRole }[]
}
