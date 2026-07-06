import { ForbiddenException } from '@nestjs/common'
import { EvaluationAccessPolicy } from './services/evaluation-access-policy.service'
import { UserRole } from 'src/common/enums/role.enum'

describe('EvaluationAccessPolicy', () => {
  const policy = new EvaluationAccessPolicy()

  it('prevents non-parent from starting evaluation role check', () => {
    expect(() =>
      policy.assertHasRole({ userId: 'u1', roles: [UserRole.TEACHER] }, [UserRole.PARENT]),
    ).toThrow(ForbiddenException)
  })

  it('assertParentOwnership rejects another parent', () => {
    expect(() =>
      policy.assertParentOwnership({ parentId: 'parent-profile-1' } as any, {
        userId: 'user-2',
        parentProfileId: 'parent-profile-2',
        roles: [UserRole.PARENT],
      }),
    ).toThrow(ForbiddenException)
  })

  it('assertParentOwnership allows owning parent', () => {
    expect(() =>
      policy.assertParentOwnership({ parentId: 'parent-profile-1' } as any, {
        userId: 'user-1',
        parentProfileId: 'parent-profile-1',
        roles: [UserRole.PARENT],
      }),
    ).not.toThrow()
  })
})
