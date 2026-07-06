import { UserRole } from 'src/common/enums/role.enum'

export function hasRole(roles: { name: UserRole }[], role: UserRole): boolean {
  return roles.some((entry) => entry.name === role)
}
