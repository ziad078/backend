import { EvaluationAccessPolicy } from './services/evaluation-access-policy.service'
import { UserRole } from 'src/common/enums/role.enum'
import { ApiException } from 'src/common/exceptions/api.exception'

describe('EvaluationAccessPolicy', () => {
  const policy = new EvaluationAccessPolicy()

  it('prevents non-parent from starting evaluation role check', () => {
    expect(() =>
      policy.assertHasRole({ userId: 'u1', roles: [UserRole.TEACHER] }, [UserRole.PARENT]),
    ).toThrow(ApiException)
  })

  it('assertParentOwnership rejects another parent', () => {
    expect(() =>
      policy.assertParentOwnership({ parentId: 'parent-profile-1' } as any, {
        userId: 'user-2',
        parentProfileId: 'parent-profile-2',
        roles: [UserRole.PARENT],
      }),
    ).toThrow(ApiException)
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
