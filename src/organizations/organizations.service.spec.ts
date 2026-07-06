import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { UserRole } from 'src/common/enums/role.enum'
import { Organization } from './entities/organization.entity'
import { OrganizationsService } from './organizations.service'

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let repo: {
    find: jest.Mock
    findOneBy: jest.Mock
    findOne: jest.Mock
    save: jest.Mock
    delete: jest.Mock
  }

  const pendingOrg: Organization = {
    id: 'org-1',
    organizationName: 'Test School',
    organizationType: OrganizationType.SCHOOL,
    approvalStatus: ApprovalStatus.PENDING,
    ownerId: 'owner-1',
    approvedById: null,
    approvedAt: null,
    rejectedById: null,
    rejectedAt: null,
    rejectionReason: null,
  } as Organization

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: repo,
        },
      ],
    }).compile()

    service = module.get(OrganizationsService)
  })

  it('assertOrganizationApproved rejects pending organization', async () => {
    repo.findOneBy.mockResolvedValue(pendingOrg)

    await expect(service.assertOrganizationApproved('org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('admin can approve pending organization and stores audit fields', async () => {
    repo.findOneBy.mockResolvedValue({ ...pendingOrg })
    repo.save.mockImplementation(async (org) => org)

    const result = await service.approve('org-1', 'admin-1')

    expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED)
    expect(result.approvedById).toBe('admin-1')
    expect(result.approvedAt).toBeInstanceOf(Date)
    expect(result.rejectionReason).toBeNull()
  })

  it('approve on already approved organization returns conflict', async () => {
    repo.findOneBy.mockResolvedValue({
      ...pendingOrg,
      approvalStatus: ApprovalStatus.APPROVED,
    })

    await expect(service.approve('org-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException)
  })

  it('admin can reject pending organization with reason', async () => {
    repo.findOneBy.mockResolvedValue({ ...pendingOrg })
    repo.save.mockImplementation(async (org) => org)

    const result = await service.reject('org-1', 'admin-1', 'Incomplete docs')

    expect(result.approvalStatus).toBe(ApprovalStatus.REJECTED)
    expect(result.rejectedById).toBe('admin-1')
    expect(result.rejectedAt).toBeInstanceOf(Date)
    expect(result.rejectionReason).toBe('Incomplete docs')
  })

  it('reject on already rejected organization returns conflict', async () => {
    repo.findOneBy.mockResolvedValue({
      ...pendingOrg,
      approvalStatus: ApprovalStatus.REJECTED,
    })

    await expect(service.reject('org-1', 'admin-1', 'reason')).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('assertCanAccessOrganization allows owner and admin only', () => {
    const org = { ...pendingOrg, ownerId: 'owner-1' } as Organization

    expect(() =>
      service.assertCanAccessOrganization(org, {
        userId: 'owner-1',
        roles: [{ name: UserRole.ORGANIZATIONOWNER }],
      } as any),
    ).not.toThrow()

    expect(() =>
      service.assertCanAccessOrganization(org, {
        userId: 'other',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).toThrow(ForbiddenException)
  })

  it('findOneOrFail throws when organization missing', async () => {
    repo.findOneBy.mockResolvedValue(null)

    await expect(service.findOneOrFail('missing')).rejects.toBeInstanceOf(NotFoundException)
  })
})
