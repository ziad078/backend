import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationChild } from '../entities/organization-child.entity'
import { PrivateChild } from '../entities/private-child.entity'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { UserRole } from 'src/common/enums/role.enum'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { hasRole } from 'src/common/utils/has-role.util'
import { isOrganizationChild } from 'src/common/helpers/child-resolver.helper'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Injectable()
export class ChildAccessPolicy {
  constructor(
    @InjectRepository(OrganizationChild)
    private readonly orgChildRepo: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private readonly privateChildRepo: Repository<PrivateChild>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async loadChildWithAccessContext(childId: string): Promise<OrganizationChild | PrivateChild> {
    const orgChild = await this.orgChildRepo.findOne({
      where: { id: childId },
      relations: {
        parent: true,
        class: { organization: { owner: true }, teacher: { user: true } },
        organization: { owner: true },
      },
    })

    if (orgChild) {
      return orgChild
    }

    const privateChild = await this.privateChildRepo.findOne({
      where: { id: childId },
      relations: {
        parent: true,
      },
    })

    if (!privateChild) {
      throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
    }

    return privateChild
  }

  async assertCanReadChild(
    childId: string,
    actor: JwtRequestUser,
  ): Promise<OrganizationChild | PrivateChild> {
    const child = await this.loadChildWithAccessContext(childId)
    this.assertReadAccess(child, actor)
    return child
  }

  async assertCanModifyChild(
    childId: string,
    actor: JwtRequestUser,
  ): Promise<OrganizationChild | PrivateChild> {
    const child = await this.loadChildWithAccessContext(childId)
    this.assertWriteAccess(child, actor)
    return child
  }

  assertReadAccess(child: OrganizationChild | PrivateChild, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return

    if (hasRole(actor.roles, UserRole.PARENT) && child.parent?.userId === actor.userId) {
      return
    }

    if (isOrganizationChild(child)) {
      const org = child.organization ?? child.class?.organization
      if (hasRole(actor.roles, UserRole.ORGANIZATIONOWNER) && org?.ownerId === actor.userId) {
        return
      }

      if (hasRole(actor.roles, UserRole.TEACHER)) {
        const teacherUserId = child.class?.teacher?.user?.id
        if (teacherUserId === actor.userId) {
          return
        }
      }
    }

    throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
  }

  assertWriteAccess(child: OrganizationChild | PrivateChild, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return

    if (hasRole(actor.roles, UserRole.PARENT) && child.parent?.userId === actor.userId) {
      return
    }

    if (isOrganizationChild(child)) {
      const org = child.organization ?? child.class?.organization
      if (hasRole(actor.roles, UserRole.ORGANIZATIONOWNER) && org?.ownerId === actor.userId) {
        return
      }
    }

    throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
  }

  assertCanListChildrenForUser(targetUserId: string, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return
    if (actor.userId === targetUserId) return
    throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
  }
}
