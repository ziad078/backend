import {
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CreateChildDto, CreateChildWithParentDto } from './dto/create-child.dto'
import { CreateChildByParentDto } from './dto/create-child-by-parent.dto'
import { UpdateChildDto } from './dto/update-child.dto'
import { OrganizationChild } from './entities/organization-child.entity'
import { PrivateChild } from './entities/private-child.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { UsersService } from 'src/users/services/users.service'
import { NotificationsService } from 'src/notifications/notifications.service'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'
import { ClassesService } from 'src/classes/classes.service'
import { AttemptUsageService } from 'src/evaluations/attempt-usage.service'
import { TransferService } from './transfer.service'
import { ChildAccessPolicy } from './services/child-access-policy.service'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'
import { ParentOrganizationSource } from 'src/users/enums/parent-organization-source.enum'
import {
  UserEvents,
  type ParentCreatedEventPayload,
} from 'src/users/enums/user-events.enum'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { PaginationQueryDto, buildPaginationMeta } from 'src/common/dto/pagination-query.dto'
import { ParentProfileSummaryDto } from './dto/parent-profile-summary.dto'
import {
  NotificationTemplateKeys,
  NotificationTypes,
} from 'src/common/constants/notification-template-keys'

export type CreateChildResponse = {
  status: 'CREATED' | 'TRANSFER_REQUIRED'
  message: string
  childId?: string
  transferRequestId?: string
}

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(OrganizationChild)
    private organizationChildrenRepository: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private privateChildrenRepository: Repository<PrivateChild>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClassesService))
    private clsService: ClassesService,
    private organizationsService: OrganizationsService,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private attemptUsageservice: AttemptUsageService,
    private transferService: TransferService,
    private childAccessPolicy: ChildAccessPolicy,
    private parentProfilesService: ParentProfilesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async isPrivateChild(id: string) {
    const child = await this.privateChildrenRepository.findOneBy({ id })
    return !!child
  }

  async getParentProfileSummary(parentUserId: string): Promise<ParentProfileSummaryDto> {
    const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(parentUserId)

    const [privateChildrenCount, organizationChildrenCount] = await Promise.all([
      this.privateChildrenRepository.count({
        where: { parent: { id: parentProfile.id } },
      }),
      this.organizationChildrenRepository.count({
        where: { parent: { id: parentProfile.id } },
      }),
    ])

    return {
      id: parentProfile.id,
      userId: parentProfile.userId,
      maxChildren: parentProfile.maxChildren,
      privateChildrenCount,
      organizationChildrenCount,
      totalChildrenCount: privateChildrenCount + organizationChildrenCount,
    }
  }

  async createChildByParent(parentUserId: string, dto: CreateChildByParentDto) {
    return this.dataSource.transaction(async (manager) => {
      // Ensure ParentProfile exists for current user
      const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(
        parentUserId,
        manager,
      )

      // Count private children for this parent
      const privateChildRepo = manager.getRepository(PrivateChild)
      const privateChildCount = await privateChildRepo.count({
        where: { parent: { id: parentProfile.id } },
      })

      if (privateChildCount >= parentProfile.maxChildren) {
        await this.notificationsService.enqueue({
          delivery: NotificationDelivery.IN_APP,
          userId: parentUserId,
          title: NotificationTemplateKeys.CHILD_LIMIT_REACHED_TITLE,
          message: NotificationTemplateKeys.CHILD_LIMIT_REACHED_MESSAGE,
          type: NotificationTypes.CHILD_LIMIT,
          metadata: { max: parentProfile.maxChildren },
        })
        throw ApiException.badRequest(ApiErrorCodes.CHILD_LIMIT_REACHED)
      }

      // Create private child
      const child = await privateChildRepo.save({
        name: dto.name,
        birthDate: dto.birthDate,
        gender: dto.gender,
        createdBy: { id: parentUserId },
        parent: { id: parentProfile.id },
      })

      return child
    })
  }

  async findPrivateChildrenForParent(parentUserId: string, query?: PaginationQueryDto) {
    const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(parentUserId)

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20

    const [children, total] = await this.privateChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data: await Promise.all(
        children.map(async (child) => {
          const usage = await this.attemptUsageservice.getUsage(
            child.id,
            parentProfile.id,
            this.dataSource.manager,
          )

          return {
            ...child,
            retakeUsed: usage.hasRetake,
            attemptsUsed: usage.totalAttempts,
          }
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    }
  }

  async findOrgChildrenForParent(parentUserId: string, query?: PaginationQueryDto) {
    const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(parentUserId)

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20

    // Get all organization-linked children for this parent (across all orgs)
    const [children, total] = await this.organizationChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
      },
      relations: { organization: true, class: { grade: true } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data: await Promise.all(
        children.map(async (child) => {
          const usage = await this.attemptUsageservice.getUsage(
            child.id,
            parentProfile.id,
            this.dataSource.manager,
          )

          return {
            ...child,
            retakeUsed: usage.hasRetake,
            attemptsUsed: usage.totalAttempts,
          }
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    }
  }

  /**
   * Optional: Get organization children for a specific parent and organization.
   */
  async findOrgChildrenForParentByOrganization(parentUserId: string, organizationId: string, query?: PaginationQueryDto) {
    const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(parentUserId)

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20

    const [children, total] = await this.organizationChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
        organization: { id: organizationId },
      },
      relations: { class: { grade: true } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data: await Promise.all(
        children.map(async (child) => {
          const usage = await this.attemptUsageservice.getUsage(
            child.id,
            parentProfile.id,
            this.dataSource.manager,
          )

          return {
            ...child,
            retakeUsed: usage.hasRetake,
            attemptsUsed: usage.totalAttempts,
          }
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    }
  }

  async createChild(
    dto: CreateChildDto,
    currentUser: JwtRequestUser,
  ): Promise<CreateChildResponse> {
    const result = await this.dataSource.transaction(async (manager) => {
      const cls = await this.clsService.findOneOrFail(dto.classId)
      const currentOrganizationId = cls.organization.id

      if (
        !(await this.organizationsService.isOrgMember(currentUser.userId, currentOrganizationId))
      ) {
        throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
      }

      await this.organizationsService.assertOrganizationApproved(currentOrganizationId)

      const parentContact = await this.parentProfilesService.getOrCreateParentByContact(
        {
          name: dto.parentName,
          email: dto.parentEmail,
          phone: dto.parentPhone,
        },
        manager,
      )

      await this.parentProfilesService.linkParentToOrganization(
        parentContact.profile.id,
        currentOrganizationId,
        ParentOrganizationSource.CHILD_REGISTRATION,
        manager,
      )

      const orgChildRepo = manager.getRepository(OrganizationChild)

      const existingChild = await orgChildRepo.findOne({
        where: {
          birthDate: dto.birthDate,
          parent: { id: parentContact.profile.id },
        },
        relations: ['organization'],
      })

      if (existingChild) {
        if (existingChild.organization.id === currentOrganizationId) {
          throw ApiException.conflict(ApiErrorCodes.CHILD_DUPLICATE)
        }

        const transfer = await this.transferService.requestTransfer(
          existingChild.id,
          'organization',
          currentOrganizationId,
          currentUser.userId,
          currentUser.email || '',
          (currentUser.roles || []).map((r) => r.name),
        )

        return {
          response: {
            status: 'TRANSFER_REQUIRED' as const,
            message: 'success.child.transferRequested',
            childId: existingChild.id,
            transferRequestId: transfer.id,
          },
          onboarding: null,
        }
      }

      const child = await orgChildRepo.save({
        name: dto.name,
        birthDate: dto.birthDate,
        gender: dto.gender,
        classId: dto.classId,
        organizationId: currentOrganizationId,
        createdBy: { id: currentUser.userId },
        parent: { id: parentContact.profile.id },
      })

      return {
        response: {
          status: 'CREATED' as const,
          message: 'success.child.created',
          childId: child.id,
        },
        onboarding:
          parentContact.accountCreated && parentContact.temporaryPassword
            ? {
                userId: parentContact.userId,
                name: parentContact.name,
                email: parentContact.email,
                phone: dto.parentPhone,
                temporaryPassword: parentContact.temporaryPassword,
                organizationId: currentOrganizationId,
                organizationName: cls.organization.organizationName,
              }
            : null,
      }
    })

    if (result.onboarding) {
      const payload: ParentCreatedEventPayload = result.onboarding
      this.eventEmitter.emit(UserEvents.PARENT_CREATED, payload)
    }

    return result.response
  }

  async create(createChildWithParentDto: CreateChildWithParentDto, currentUser: JwtRequestUser) {
    return this.createChild(
      {
        ...createChildWithParentDto.child,
        parentName: createChildWithParentDto.parent.name,
        parentEmail: createChildWithParentDto.parent.email,
        parentPhone: createChildWithParentDto.parent.phone,
      },
      currentUser,
    )
  }

  async findAll(query?: PaginationQueryDto) {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const skip = (page - 1) * limit

    const [orgCount, privateCount] = await Promise.all([
      this.organizationChildrenRepository.count(),
      this.privateChildrenRepository.count(),
    ])

    // Paginate across the concatenation [org..., private...] so each page
    // returns at most `limit` items with stable global offsets.
    const orgTake = Math.max(0, Math.min(limit, orgCount - skip))
    const orgChildren =
      orgTake > 0
        ? await this.organizationChildrenRepository.find({
            order: { createdAt: 'DESC' },
            skip,
            take: orgTake,
          })
        : []

    const privateSkip = Math.max(0, skip - orgCount)
    const privateTake = limit - orgChildren.length
    const privateChildren =
      privateTake > 0
        ? await this.privateChildrenRepository.find({
            order: { createdAt: 'DESC' },
            skip: privateSkip,
            take: privateTake,
          })
        : []

    return {
      data: [...orgChildren, ...privateChildren],
      meta: buildPaginationMeta(page, limit, orgCount + privateCount),
    }
  }

  async findAllByOrganization(orgId: string, currentUser: JwtRequestUser) {
    if (!(await this.organizationsService.isOrgMember(currentUser.userId, orgId))) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    const children = await this.organizationChildrenRepository.find({
      where: {
        organization: { id: orgId },
      },
      relations: { class: { grade: true } },
    })

    return {
      children: children.map((child) => ({
        ...child,
        gradeName: child.class?.grade?.name,
        className: child.class?.name,
      })),
    }
  }

  async findByUser(userId: string, actor: JwtRequestUser, query?: PaginationQueryDto) {
    this.childAccessPolicy.assertCanListChildrenForUser(userId, actor)

    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const skip = (page - 1) * limit

    const [orgCount, privateCount] = await Promise.all([
      this.organizationChildrenRepository.count({ where: { createdBy: { id: userId } } }),
      this.privateChildrenRepository.count({ where: { createdBy: { id: userId } } }),
    ])

    const orgTake = Math.max(0, Math.min(limit, orgCount - skip))
    const orgChildren =
      orgTake > 0
        ? await this.organizationChildrenRepository.find({
            where: { createdBy: { id: userId } },
            order: { createdAt: 'DESC' },
            skip,
            take: orgTake,
          })
        : []

    const privateSkip = Math.max(0, skip - orgCount)
    const privateTake = limit - orgChildren.length
    const privateChildren =
      privateTake > 0
        ? await this.privateChildrenRepository.find({
            where: { createdBy: { id: userId } },
            order: { createdAt: 'DESC' },
            skip: privateSkip,
            take: privateTake,
          })
        : []

    return {
      data: [...orgChildren, ...privateChildren],
      meta: buildPaginationMeta(page, limit, orgCount + privateCount),
    }
  }

  async findOne(id: string, actor: JwtRequestUser) {
    const child = await this.childAccessPolicy.assertCanReadChild(id, actor)
    return { child }
  }

  async findOneOrFail(id: string) {
    const orgChild = await this.organizationChildrenRepository.findOneBy({
      id,
    })
    if (orgChild) return orgChild

    const privateChild = await this.privateChildrenRepository.findOneBy({ id })
    if (privateChild) return privateChild

    throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND)
  }

  async save(child: OrganizationChild | PrivateChild) {
    if (child instanceof OrganizationChild) {
      return this.organizationChildrenRepository.save(child)
    }
    return this.privateChildrenRepository.save(child)
  }

  async update(id: string, updateChildDto: UpdateChildDto, actor: JwtRequestUser) {
    const child = await this.childAccessPolicy.assertCanModifyChild(id, actor)

    // Only the child's own mutable fields are persisted; parent contact
    // fields present on the DTO are not columns on the child entities.
    const { name, birthDate, gender, classId } = updateChildDto

    if (child instanceof OrganizationChild) {
      // Prevent moving a child into a class that belongs to another organization.
      if (classId && classId !== child.classId) {
        const targetClass = await this.clsService.findOneOrFail(classId)
        if (targetClass.organization.id !== child.organizationId) {
          throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED)
        }
      }

      const updated = await this.organizationChildrenRepository.save({
        ...child,
        ...(name !== undefined ? { name } : {}),
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(classId !== undefined ? { classId } : {}),
      })
      return updated
    }

    const updated = await this.privateChildrenRepository.save({
      ...child,
      ...(name !== undefined ? { name } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
      ...(gender !== undefined ? { gender } : {}),
    })
    return updated
  }

  async remove(id: string, actor: JwtRequestUser) {
    const child = await this.childAccessPolicy.assertCanModifyChild(id, actor)

    if (child instanceof OrganizationChild) {
      return this.organizationChildrenRepository.remove(child)
    }
    return this.privateChildrenRepository.remove(child)
  }
}
