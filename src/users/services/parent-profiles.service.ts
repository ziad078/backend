import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { ParentProfile } from '../entities/parent-profile.entity'
import { ParentOrganization } from '../entities/parent-organization.entity'
import { User } from '../entities/user.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import { UserRole } from 'src/common/enums/role.enum'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { ParentOrganizationStatus } from '../enums/parent-organization-status.enum'
import { ParentOrganizationSource } from '../enums/parent-organization-source.enum'
import { UsersService } from './users.service'
import { randomUUID } from 'crypto'

@Injectable()
export class ParentProfilesService {
  constructor(
    @InjectRepository(ParentProfile)
    private readonly parentProfileRepository: Repository<ParentProfile>,
    @InjectRepository(ParentOrganization)
    private readonly parentOrgRepository: Repository<ParentOrganization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Ensure a ParentProfile exists for a user with PARENT role.
   * Creates the profile if missing.
   */
  async ensureParentProfileForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<ParentProfile> {
    const repo = manager ? manager.getRepository(ParentProfile) : this.parentProfileRepository

    // Check if profile already exists
    let profile = await repo.findOne({
      where: { userId },
      relations: ['user'],
    })

    if (profile) {
      return profile
    }

    // Load user to verify it has/should have PARENT role
    const userRepo = manager ? manager.getRepository(User) : this.userRepository

    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    })

    if (!user) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    // Ensure user has PARENT role
    const hasParentRole = user.roles?.some((r) => r.name === UserRole.PARENT)
    if (!hasParentRole) {
      // Create role if not present (business logic supports this during child creation)
      if (manager) {
        const updatedUser = await this.usersService.addRolesToUser(
          userId,
          [UserRole.PARENT],
          manager,
        )
        user.roles = updatedUser.roles
      }
    }

    // Create new profile
    profile = new ParentProfile()
    profile.userId = userId
    profile.user = user

    return await repo.save(profile)
  }

  /**
   * Find parent profile by user ID.
   */
  async findByUserId(userId: string): Promise<ParentProfile> {
    const parentProfile = await this.parentProfileRepository.findOne({
      where: { userId },
      relations: ['user', 'organizationLinks', 'organizationChildren', 'privateChildren'],
    })
    if (!parentProfile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }
    return parentProfile
  }

  /**
   * Find parent profile by ID.
   */
  async findById(parentProfileId: string): Promise<ParentProfile | null> {
    return this.parentProfileRepository.findOne({
      where: { id: parentProfileId },
      relations: ['user', 'organizationLinks', 'organizationChildren', 'privateChildren'],
    })
  }

  /**
   * Get the User ID for a parent profile.
   */
  async getUserIdForParentProfile(parentProfileId: string): Promise<string> {
    const profile = await this.parentProfileRepository.findOne({
      where: { id: parentProfileId },
      select: ['userId'],
    })

    if (!profile) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    return profile.userId
  }

  /**
   * Link a parent to an organization. Does not duplicate links.
   * Default status is ACTIVE.
   * If link is already BLOCKED, does not silently reactivate.
   */
  async linkParentToOrganization(
    parentProfileId: string,
    organizationId: string,
    source: ParentOrganizationSource,
    manager?: EntityManager,
  ): Promise<ParentOrganization> {
    const repo = manager ? manager.getRepository(ParentOrganization) : this.parentOrgRepository

    // Check if link already exists
    let link = await repo.findOne({
      where: {
        parentId: parentProfileId,
        organizationId,
      },
    })

    if (link) {
      // Link already exists, don't modify it
      // If it's blocked, keep it blocked (don't silently reactivate)
      return link
    }

    // Create new link
    link = new ParentOrganization()
    link.parentId = parentProfileId
    link.organizationId = organizationId
    link.status = ParentOrganizationStatus.ACTIVE
    link.source = source

    return await repo.save(link)
  }

  /**
   * Get all organizations for a parent profile.
   */
  async getOrganizationsForParent(parentProfileId: string): Promise<Organization[]> {
    const links = await this.parentOrgRepository.find({
      where: { parentId: parentProfileId },
      relations: ['organization'],
    })

    return links.map((link) => link.organization)
  }

  /**
   * Get all parent profiles linked to an organization.
   */
  async getParentsByOrganization(organizationId: string): Promise<ParentProfile[]> {
    const links = await this.parentOrgRepository.find({
      where: { organizationId },
      relations: ['parent', 'parent.user'],
    })

    return links.map((link) => link.parent)
  }

  /**
   * Find or create a parent user by contact info.
   * Ensures parent has PARENT role.
   * Creates ParentProfile if missing.
   */
  async getOrCreateParentByContact(
    parentData: { name?: string; email?: string; phone: string },
    manager?: EntityManager,
  ): Promise<ParentProfile> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepository

    const parentEmail = parentData.email?.toLowerCase().trim()

    // Find existing parent by phone or email
    const parentMatches = await userRepo.find({
      where: [{ phone: parentData.phone }, ...(parentEmail ? [{ email: parentEmail }] : [])],
      relations: ['roles'],
    })

    // Remove duplicates by ID
    const uniqueParents = Array.from(new Map(parentMatches.map((p) => [p.id, p])).values())

    if (uniqueParents.length > 1) {
      throw ApiException.conflict(ApiErrorCodes.USER_ALREADY_EXISTS)
    }

    let parent = uniqueParents[0]

    if (parent) {
      // Ensure parent has PARENT role
      if (!parent.roles?.some((r) => r.name === UserRole.PARENT)) {
        parent = await this.usersService.addRolesToUser(parent.id, [UserRole.PARENT], manager)
      }

      // Update parent info if provided
      const parentPatch: Partial<User> = {}
      if (parentData.name) parentPatch.name = parentData.name
      if (parentEmail) parentPatch.email = parentEmail
      parentPatch.phone = parentData.phone

      if (Object.keys(parentPatch).length > 0) {
        parent = await this.usersService.updateUser(parent.id, parentPatch, manager)
      }
    } else {
      // Create new parent user
      if (!parentData.name) {
        throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
      }

      const userManager = manager ?? this.userRepository.manager
      const parentPassword = this.createTemporaryPassword()
      parent = await this.usersService.create(
        {
          name: parentData.name,
          email: parentEmail ?? this.createPlaceholderEmail(parentData.phone),
          phone: parentData.phone,
          password: parentPassword,
        },
        [UserRole.PARENT],
        userManager,
      )
    }

    // Ensure ParentProfile exists
    return this.ensureParentProfileForUser(parent.id, manager)
  }

  private createTemporaryPassword(): string {
    return `Temp-${randomUUID()}aA1!`
  }

  private createPlaceholderEmail(phone: string): string {
    const normalizedPhone = phone.replace(/\D/g, '')
    return `parent-${normalizedPhone}-${randomUUID()}@placeholder.ithraa.local`
  }
}
