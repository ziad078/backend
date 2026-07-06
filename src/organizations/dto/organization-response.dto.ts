import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { Organization } from '../entities/organization.entity'

export class OrganizationResponseDto {
  id: string
  organizationName: string
  organizationType: OrganizationType
  approvalStatus: ApprovalStatus
  ownerId: string
  approvedById: string | null
  approvedAt: Date | null
  rejectedById: string | null
  rejectedAt: Date | null
  rejectionReason: string | null

  static fromEntity(org: Organization): OrganizationResponseDto {
    return {
      id: org.id,
      organizationName: org.organizationName,
      organizationType: org.organizationType,
      approvalStatus: org.approvalStatus,
      ownerId: org.ownerId,
      approvedById: org.approvedById ?? null,
      approvedAt: org.approvedAt ?? null,
      rejectedById: org.rejectedById ?? null,
      rejectedAt: org.rejectedAt ?? null,
      rejectionReason: org.rejectionReason ?? null,
    }
  }
}
