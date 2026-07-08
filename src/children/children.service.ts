import {
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
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
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

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
  ) {}

  async isPrivateChild(id: string) {
    const child = await this.privateChildrenRepository.findOneBy({ id })
    return !!child
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
          title: 'Child limit reached',
          message: `You have reached the maximum of ${parentProfile.maxChildren} children on your account.`,
        })
        throw ApiException.badRequest(ApiErrorCodes.CHILD_LIMIT_REACHED, 'Child limit reached')
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

  async findPrivateChildrenForParent(parentUserId: string) {
    // Resolve ParentProfile for user
    const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
    if (!parentProfile) {
      return { children: [], count: 0 }
    }

    const [children, count] = await this.privateChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
      },
      order: { createdAt: 'DESC' },
    })

    return {
      children: await Promise.all(
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
      count,
    }
  }

  async findOrgChildrenForParent(parentUserId: string) {
    // Resolve ParentProfile for user
    const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
    if (!parentProfile) {
      return { children: [], count: 0 }
    }

    // Get all organization-linked children for this parent (across all orgs)
    const [children, count] = await this.organizationChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
      },
      relations: { organization: true, class: { grade: true } },
      order: { createdAt: 'DESC' },
    })

    return {
      children: await Promise.all(
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
      count,
    }
  }

  /**
   * Optional: Get organization children for a specific parent and organization.
   */
  async findOrgChildrenForParentByOrganization(parentUserId: string, organizationId: string) {
    // Resolve ParentProfile for user
    const parentProfile = await this.parentProfilesService.findByUserId(parentUserId)
    if (!parentProfile) {
      return { children: [], count: 0 }
    }

    const [children, count] = await this.organizationChildrenRepository.findAndCount({
      where: {
        parent: { id: parentProfile.id },
        organization: { id: organizationId },
      },
      relations: { class: { grade: true } },
      order: { createdAt: 'DESC' },
    })

    return {
      children: await Promise.all(
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
      count,
    }
  }

  async createChild(
    dto: CreateChildDto,
    currentUser: JwtRequestUser,
  ): Promise<CreateChildResponse> {
    return this.dataSource.transaction(async (manager) => {
      const cls = await this.clsService.findOneOrFail(dto.classId)
      const currentOrganizationId = cls.organization.id

      if (
        !(await this.organizationsService.isOrgMember(currentUser.userId, currentOrganizationId))
      ) {
        throw ApiException.forbidden(ApiErrorCodes.CHILD_ACCESS_DENIED, 'You are not allowed to add children to this class')
      }

      await this.organizationsService.assertOrganizationApproved(currentOrganizationId)

      // Get or create parent profile using ParentProfilesService
      const parentProfile = await this.parentProfilesService.getOrCreateParentByContact(
        {
          name: dto.parentName,
          email: dto.parentEmail,
          phone: dto.parentPhone,
        },
        manager,
      )

      console.log(parentProfile)

      // Link parent to organization if not already linked
      await this.parentProfilesService.linkParentToOrganization(
        parentProfile.id,
        currentOrganizationId,
        ParentOrganizationSource.CHILD_REGISTRATION,
        manager,
      )

      // Check parent's total children limit
      const privateChildRepo = manager.getRepository(PrivateChild)
      const orgChildRepo = manager.getRepository(OrganizationChild)
      const privateChildCount = await privateChildRepo.count({
        where: { parent: { id: parentProfile.id } },
      })
      const orgChildCount = await orgChildRepo.count({
        where: { parent: { id: parentProfile.id } },
      })
      const totalChildCount = privateChildCount + orgChildCount

      if (totalChildCount >= parentProfile.maxChildren) {
        await this.notificationsService.enqueue({
          delivery: NotificationDelivery.IN_APP,
          userId: parentProfile.userId,
          title: 'Child limit reached',
          message: `Parent has reached the maximum of ${parentProfile.maxChildren} children on their account.`,
        })
        throw ApiException.forbidden(ApiErrorCodes.CHILD_LIMIT_REACHED, 'Parent has reached the child limit')
      }

      // Check for existing organization child by birthDate and ParentProfile
      const existingChild = await orgChildRepo.findOne({
        where: {
          birthDate: dto.birthDate,
          parent: { id: parentProfile.id },
        },
        relations: ['organization'],
      })

      if (existingChild) {
        if (existingChild.organization.id === currentOrganizationId) {
          throw ApiException.conflict(ApiErrorCodes.CHILD_DUPLICATE, 'Child already exists in your school')
        }

        // Transfer flow: child exists in another org for same parent
        const transfer = await this.transferService.requestTransfer(
          existingChild.id,
          'organization',
          currentOrganizationId,
          currentUser.userId,
          currentUser.email || '',
          (currentUser.roles || []).map((r) => r.name),
        )

        return {
          status: 'TRANSFER_REQUIRED',
          message: 'Child already exists in another school. Transfer requested.',
          childId: existingChild.id,
          transferRequestId: transfer.id,
        }
      }

      // Create new organization child
      const child = await orgChildRepo.save({
        name: dto.name,
        birthDate: dto.birthDate,
        gender: dto.gender,
        classId: dto.classId,
        organizationId: currentOrganizationId,
        createdBy: { id: currentUser.userId },
        parent: { id: parentProfile.id },
      })

      return {
        status: 'CREATED',
        message: 'Child created successfully',
        childId: child.id,
      }
    })
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

  async findAll() {
    const [orgChildren, orgCount] = await this.organizationChildrenRepository.findAndCount()
    const [privateChildren, privateCount] = await this.privateChildrenRepository.findAndCount()
    return {
      children: [...orgChildren, ...privateChildren],
      count: orgCount + privateCount,
    }
  }

  async findAllByOrganization(orgId: string, currentUser: JwtRequestUser) {
    if (!(await this.organizationsService.isOrgMember(currentUser.userId, orgId))) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'You are not allowed to access these data')
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
        gradeName: child.class?.grade.name,
        className: child.class?.name,
      })),
    }
  }

  async findByUser(userId: string, actor: JwtRequestUser) {
    this.childAccessPolicy.assertCanListChildrenForUser(userId, actor)

    const [orgChildren, orgCount] = await this.organizationChildrenRepository.findAndCount({
      where: { createdBy: { id: userId } },
    })
    const [privateChildren, privateCount] = await this.privateChildrenRepository.findAndCount({
      where: { createdBy: { id: userId } },
    })
    return {
      children: [...orgChildren, ...privateChildren],
      count: orgCount + privateCount,
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

    throw ApiException.notFound(ApiErrorCodes.CHILD_NOT_FOUND, 'Child not found')
  }

  async save(child: OrganizationChild | PrivateChild) {
    if (child instanceof OrganizationChild) {
      return this.organizationChildrenRepository.save(child)
    }
    return this.privateChildrenRepository.save(child)
  }

  async update(id: string, updateChildDto: UpdateChildDto, actor: JwtRequestUser) {
    const child = await this.childAccessPolicy.assertCanModifyChild(id, actor)

    if (child instanceof OrganizationChild) {
      const updated = await this.organizationChildrenRepository.save({
        ...child,
        ...updateChildDto,
      })
      return updated
    }

    const updated = await this.privateChildrenRepository.save({
      ...child,
      ...updateChildDto,
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
