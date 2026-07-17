import { HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ChildAccessPolicy } from './services/child-access-policy.service'
import { OrganizationChild } from './entities/organization-child.entity'
import { PrivateChild } from './entities/private-child.entity'

describe('ChildAccessPolicy', () => {
  let policy: ChildAccessPolicy
  let orgChildRepo: { findOne: jest.Mock }
  let privateChildRepo: { findOne: jest.Mock }

  const orgChild = {
    id: 'org-child-1',
    organizationId: 'org-1',
    parent: { userId: 'parent-1' },
    organization: { ownerId: 'owner-1' },
    class: null,
  } as unknown as OrganizationChild

  const privateChild = {
    id: 'private-child-1',
    parent: { userId: 'parent-1' },
  } as PrivateChild

  beforeEach(async () => {
    orgChildRepo = { findOne: jest.fn() }
    privateChildRepo = { findOne: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildAccessPolicy,
        { provide: getRepositoryToken(OrganizationChild), useValue: orgChildRepo },
        { provide: getRepositoryToken(PrivateChild), useValue: privateChildRepo },
        {
          provide: OrganizationsService,
          useValue: {},
        },
      ],
    }).compile()

    policy = module.get(ChildAccessPolicy)
  })

  it('allows parent to read own organization child', async () => {
    orgChildRepo.findOne.mockResolvedValue(orgChild)

    await expect(
      policy.assertCanReadChild('org-child-1', {
        userId: 'parent-1',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).resolves.toBeDefined()
  })

  it('denies parent access to another parent organization child', async () => {
    orgChildRepo.findOne.mockResolvedValue(orgChild)

    await expect(
      policy.assertCanReadChild('org-child-1', {
        userId: 'parent-2',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).rejects.toBeInstanceOf(ApiException)

    await expect(
      policy.assertCanReadChild('org-child-1', {
        userId: 'parent-2',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
  })

  it('allows organization owner to read child in own organization', async () => {
    orgChildRepo.findOne.mockResolvedValue(orgChild)

    await expect(
      policy.assertCanReadChild('org-child-1', {
        userId: 'owner-1',
        roles: [{ name: UserRole.ORGANIZATIONOWNER }],
      } as any),
    ).resolves.toBeDefined()
  })
})
