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

/**
 * Prefer FK columns so callers that load attempts without relations still resolve child ids.
 * Fall back to loaded relations for legacy payloads.
 */
export function getChildId(entity: {
  organizationChildId?: string | null
  privateChildId?: string | null
  organizationChild?: OrganizationChild | null
  privateChild?: PrivateChild | null
}): string | null {
  if (entity.organizationChildId) return entity.organizationChildId
  if (entity.privateChildId) return entity.privateChildId
  return resolveChild(entity)?.id ?? null
}

export function getChildType(entity: {
  organizationChildId?: string | null
  privateChildId?: string | null
  organizationChild?: OrganizationChild | null
  privateChild?: PrivateChild | null
}): 'organization' | 'private' | null {
  if (entity.organizationChildId || entity.organizationChild) return 'organization'
  if (entity.privateChildId || entity.privateChild) return 'private'
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
