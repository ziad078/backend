import { BaseClassResponse } from './base-class-response.dto'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'

export interface OrgOwnerClassResponse extends BaseClassResponse {
  gradeName: string
  children: Partial<OrganizationChild>[]
}
