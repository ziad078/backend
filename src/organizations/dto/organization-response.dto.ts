import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { Organization } from '../entities/organization.entity'

export class OrganizationOwnerSummaryDto {
  id: string
  name: string
  email: string
}

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
  owner?: OrganizationOwnerSummaryDto
  createdAt?: Date | null

  static fromEntity(org: Organization): OrganizationResponseDto {
    const dto: OrganizationResponseDto = {
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

    if (org.owner) {
      dto.owner = {
        id: org.owner.id,
        name: org.owner.name,
        email: org.owner.email,
      }
      dto.createdAt = org.owner.createdAt ?? null
    }

    return dto
  }
}
