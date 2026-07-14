import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

export type Child = OrganizationChild | PrivateChild

export function resolveChild(entity: {
  organizationChild?: OrganizationChild | null
  privateChild?: PrivateChild | null
}): Child | null {
  return entity.organizationChild ?? entity.privateChild ?? null
}

export function getChildId(entity: {
  organizationChild?: OrganizationChild | null
  privateChild?: PrivateChild | null
}): string | null {
  const child = resolveChild(entity)
  return child?.id ?? null
}

export function getChildType(entity: {
  organizationChild?: OrganizationChild | null
  privateChild?: PrivateChild | null
}): 'organization' | 'private' | null {
  if (entity.organizationChild) return 'organization'
  if (entity.privateChild) return 'private'
  return null
}

export function ensureSingleChildType(
  organizationChildId?: string | null,
  privateChildId?: string | null,
): void {
  if (organizationChildId && privateChildId) {
    throw ApiException.badRequest(ApiErrorCodes.CHILD_INVALID_TYPE)
  }
}

export function isOrganizationChild(
  child: OrganizationChild | PrivateChild,
): child is OrganizationChild {
  return 'organizationId' in child
}

export function isPrivateChild(child: OrganizationChild | PrivateChild): child is PrivateChild {
  return 'organizationId' in child === false
}
