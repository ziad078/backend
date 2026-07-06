import { User } from 'src/users/entities/user.entity'
import { EntityManager } from 'typeorm'
import SignupStrategy from './signup.strategy'
import { OrganizationSignupDto } from '../dto/beneficiaries/organization-signup.dto'
import { Organization } from 'src/organizations/entities/organization.entity'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'

export class OrganizationSignupStrategy implements SignupStrategy {
  async saveExtraData(manager: EntityManager, user: User, dto: OrganizationSignupDto) {
    const organization = manager.create(Organization, {
      organizationName: dto.organizationName,
      organizationType: dto.organizationType,
      approvalStatus: ApprovalStatus.PENDING,
      owner: user,
    })

    await manager.save(organization)

    user.ownedOrganization = organization

    await manager.save(user)
  }
}
