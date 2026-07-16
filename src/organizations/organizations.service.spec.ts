import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import EventEmitter2 from 'eventemitter2'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { UserRole } from 'src/common/enums/role.enum'
import { Organization } from './entities/organization.entity'
import { OrganizationsService } from './organizations.service'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let repo: {
    find: jest.Mock
    findOne: jest.Mock
    findOneBy: jest.Mock
    save: jest.Mock
    delete: jest.Mock
    createQueryBuilder: jest.Mock
  }
  let parentProfileRepo: {
    findOne: jest.Mock
  }
  let events: { emit: jest.Mock }

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
    owner: {
      id: 'owner-1',
      name: 'Owner Name',
      email: 'owner@test.com',
    } as Organization['owner'],
  } as Organization

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(async (entity) => entity),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    }
    events = { emit: jest.fn() }
    parentProfileRepo = { findOne: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: repo,
        },
        {
          provide: getRepositoryToken(ParentProfile),
          useValue: parentProfileRepo,
        },
        {
          provide: EventEmitter2,
          useValue: events,
        },
      ],
    }).compile()

    service = module.get(OrganizationsService)
  })

  it('assertOrganizationApproved rejects pending organization', async () => {
    repo.findOne.mockResolvedValue(pendingOrg)

    await expect(service.assertOrganizationApproved('org-1')).rejects.toBeInstanceOf(ApiException)
    await expect(service.assertOrganizationApproved('org-1')).rejects.toMatchObject({
      code: ApiErrorCodes.ORGANIZATION_NOT_APPROVED,
    })
  })

  it('admin can approve pending organization and stores audit fields', async () => {
    repo.findOne.mockResolvedValue({ ...pendingOrg })
    repo.save.mockImplementation(async (org) => org)

    const result = await service.approve('org-1', 'admin-1')

    expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED)
    expect(result.approvedById).toBe('admin-1')
    expect(result.approvedAt).toBeInstanceOf(Date)
    expect(result.rejectionReason).toBeNull()
    expect(events.emit).toHaveBeenCalled()
  })

  it('approve on already approved organization returns conflict', async () => {
    repo.findOne.mockResolvedValue({
      ...pendingOrg,
      approvalStatus: ApprovalStatus.APPROVED,
    })

    await expect(service.approve('org-1', 'admin-1')).rejects.toBeInstanceOf(ApiException)
    await expect(service.approve('org-1', 'admin-1')).rejects.toMatchObject({
      code: ApiErrorCodes.ORGANIZATION_ALREADY_APPROVED,
    })
  })

  it('admin can reject pending organization with reason', async () => {
    repo.findOne.mockResolvedValue({ ...pendingOrg })
    repo.save.mockImplementation(async (org) => org)

    const result = await service.reject('org-1', 'admin-1', 'Incomplete docs')

    expect(result.approvalStatus).toBe(ApprovalStatus.REJECTED)
    expect(result.rejectedById).toBe('admin-1')
    expect(result.rejectedAt).toBeInstanceOf(Date)
    expect(result.rejectionReason).toBe('Incomplete docs')
    expect(events.emit).toHaveBeenCalled()
  })

  it('reject on already rejected organization returns conflict', async () => {
    repo.findOne.mockResolvedValue({
      ...pendingOrg,
      approvalStatus: ApprovalStatus.REJECTED,
    })

    await expect(service.reject('org-1', 'admin-1', 'reason')).rejects.toBeInstanceOf(ApiException)
    await expect(service.reject('org-1', 'admin-1', 'reason')).rejects.toMatchObject({
      code: ApiErrorCodes.ORGANIZATION_ALREADY_REJECTED,
    })
  })

  it('findByParent returns empty array when no organizations are linked', async () => {
    repo.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })

    await expect(service.findByParent('parent-1')).resolves.toEqual([])
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
    ).toThrow(ApiException)
  })

  it('assertParentProfileAccess allows matching parent user', async () => {
    parentProfileRepo.findOne.mockResolvedValue({ id: 'parent-1', userId: 'user-1' })

    await expect(
      service.assertParentProfileAccess('parent-1', 'user-1'),
    ).resolves.toBeUndefined()
  })

  it('assertParentProfileAccess rejects other users', async () => {
    parentProfileRepo.findOne.mockResolvedValue({ id: 'parent-1', userId: 'user-1' })

    await expect(service.assertParentProfileAccess('parent-1', 'user-2')).rejects.toMatchObject({
      code: ApiErrorCodes.AUTH_FORBIDDEN,
    })
  })

  it('findOneOrFail throws when organization missing', async () => {
    repo.findOne.mockResolvedValue(null)

    await expect(service.findOneOrFail('missing')).rejects.toBeInstanceOf(ApiException)
    await expect(service.findOneOrFail('missing')).rejects.toMatchObject({
      code: ApiErrorCodes.ORGANIZATION_NOT_FOUND,
    })
  })
})
