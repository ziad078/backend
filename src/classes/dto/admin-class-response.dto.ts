import { OrgOwnerClassResponse } from './orgOwner-class-response.dto'

export interface AdminClassResponse extends OrgOwnerClassResponse {
  organizationName: string
}
