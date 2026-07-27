import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import { UserRole } from 'src/common/enums/role.enum'
import { SessionService } from 'src/session/session.service'
import { User } from 'src/users/entities/user.entity'
import { DataSource } from 'typeorm'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { ParentSignupDto } from '../dto/parent-signup.dto'
import { AccountType } from 'src/common/enums/account-type.enum'
import { Role } from 'src/users/entities/user-roles.entity'
import { SignupStrategyFactory } from '../factories/signup.factory'
import { BeneficiariesSignupDto } from '../dto/beneficiaries/beneficiaries-signup.dto'
import { EnrichersSignupDto } from '../dto/enrichers/enrichers-signup.dto'
import { UsersService } from './users.service'
import { Enricher } from '../entities/enricher.entity'
import { ParentProfilesService } from './parent-profiles.service'
import {
  NotificationTemplateKeys,
  NotificationTypes,
} from 'src/common/constants/notification-template-keys'
import { Organization } from 'src/organizations/entities/organization.entity'
import { NotificationsService } from 'src/notifications/notifications.service'
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum'
import EventEmitter2 from 'eventemitter2'
import { OrganizationEvents } from 'src/organizations/enums/organization-events.enum'

export type TokenPayload = {
  sub: string
  email: string
  phone: string
  roles: Role[]
}

@Injectable()
export class AuthProvider {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly dataSource: DataSource,
    private readonly strategyFactory: SignupStrategyFactory,
    private readonly notificationsService: NotificationsService,
    private readonly events: EventEmitter2,
    private readonly parentProfilesService: ParentProfilesService,
  ) {}

  private static readonly EMAIL_VERIFICATION_TOKEN_TYPE = 'email_verification'
  private static readonly PASSWORD_RESET_TOKEN_TYPE = 'password_reset'

  generateVerificationToken(userId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: AuthProvider.EMAIL_VERIFICATION_TOKEN_TYPE,
      },
      { expiresIn: '10d' },
    )
  }

  generatePasswordResetToken(userId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: AuthProvider.PASSWORD_RESET_TOKEN_TYPE,
      },
      { expiresIn: '1h' },
    )
  }

  async verifyEmail(token: string) {
    // Only JWT verification failures should map to "invalid token"; downstream
    // errors (missing user, DB issues) must surface on their own so we never
    // mask a real failure as a bad token.
    let payload: { sub?: string; userId?: string; type?: string }
    try {
      payload = this.jwtService.verify(token)
    } catch {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    if (payload.type !== AuthProvider.EMAIL_VERIFICATION_TOKEN_TYPE) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    // Tokens are signed with `sub`; tolerate a legacy `userId` claim for any
    // verification links issued before the payload was standardized.
    const userId = payload.sub ?? payload.userId
    if (!userId) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    const user = await this.usersService.findById(userId)
    if (!user) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    // Idempotent: re-clicking an old link on an already-verified account
    // should succeed quietly rather than error.
    if (!user.isEmailVerified) {
      user.isEmailVerified = true
      await this.usersService.save(user)
    }

    return { message: 'Email verified successfully', ok: true, isEmailVerified: true }
  }

  async requestPasswordReset(phone: string) {
    const user = await this.usersService.findByPhone(phone)

    if (user?.email) {
      await this.notificationsService.enqueue({
        userId: user.id,
        email: user.email,
        delivery: NotificationDelivery.RESET_PASSWORD,
        title: 'Reset password',
        message: 'Password reset request',
        type: 'reset-password',
      })
    }

    return {
      message: 'If an account exists with this phone number, a reset link has been sent to the registered email.',
      ok: true,
    }
  }

  async resetPassword(token: string, password: string) {
    let payload: { sub?: string; userId?: string; type?: string }
    try {
      payload = this.jwtService.verify(token)
    } catch {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    if (payload.type !== AuthProvider.PASSWORD_RESET_TOKEN_TYPE) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    const userId = payload.sub ?? payload.userId
    if (!userId) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_TOKEN_INVALID)
    }

    const user = await this.usersService.findById(userId)
    if (!user) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    await this.usersService.updateUser(userId, { password })
    await this.sessionsService.deleteAllUserSessions(userId)

    return { message: 'Password reset successfully', ok: true }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId)
    if (!user) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_PASSWORD_INCORRECT)
    }

    const samePassword = await bcrypt.compare(newPassword, user.password)
    if (samePassword) {
      throw ApiException.badRequest(ApiErrorCodes.AUTH_PASSWORD_SAME)
    }

    await this.usersService.updateUser(userId, { password: newPassword })
    await this.sessionsService.deleteAllUserSessions(userId)

    return { message: 'Password changed successfully', ok: true }
  }

  async validateUser(phone: string, pass: string) {
    const user = await this.usersService.findByPhone(phone)
    if (!user) return null

    const match = await bcrypt.compare(pass, user.password)

    if (!match) return null

    return user
  }

  async isAlreadyExits(phone: string, email: string) {
    const user =
      (await this.usersService.findByPhone(phone)) || (await this.usersService.findByEmail(email))
    return Boolean(user)
  }

  async login(user: User, device?: string, ip?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
    }

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    })

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '60d',
    })

    await this.sessionsService.create({
      userId: user.id,
      device,
      ip,
      refreshToken,
    })

    return {
      accessToken,
      refreshToken,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      expiresIn: '30d',
    }
  }

  async beneficiariesSignup(dto: BeneficiariesSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const strategy = this.strategyFactory.getStrategy(dto.accountType)

      switch (dto.accountType) {
        case AccountType.ORGANIZATION: {
          const user = await this.usersService.create(
            {
              email: dto.email,
              phone: dto.phone,
              name: dto.name,
              password: dto.password,
            },
            [UserRole.ORGANIZATIONOWNER],
            manager,
          )
          await strategy?.saveExtraData(manager, user, dto)
          const organization = await manager.findOne(Organization, {
            where: { ownerId: user.id },
          })
          this.events.emit(OrganizationEvents.REGISTERED, {
            orgId: organization?.id,
            orgName: organization?.organizationName,
            ownerId: user.id,
            ownerName: user.name,
            ownerEmail: user.email,
            ownerPhone: user.phone,
          })
          return {
            user,
            organization: organization
              ? {
                  id: organization.id,
                  organizationName: organization.organizationName,
                  organizationType: organization.organizationType,
                  approvalStatus: organization.approvalStatus,
                }
              : null,
          }
        }
      }
    })
  }

  async enrichersSignup(dto: EnrichersSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.create(
        {
          email: dto.email,
          phone: dto.phone,
          name: dto.name,
          password: dto.password,
        },
        [UserRole.ENRICHER],
        manager,
      )

      const enricher = manager.create(Enricher, {
        organizationName: dto.organizationName,
        user,
      })

      await manager.save(enricher)

      await this.notificationsService.enqueue({
        userId: user.id,
        title: 'Welcome 🎉',
        message: `Welcome ${user.name}, we're happy to have you معنا!`,
        delivery: NotificationDelivery.BOTH, // email + inapp
        email: user.email,
      })
      await this.notificationsService.enqueue({
        userId: user.id,
        title: 'verification email',
        message: `Welcome ${user.name}, we're happy to have you معنا!`,
        delivery: NotificationDelivery.VERIFY_EMAIL, // email + inapp
        email: user.email,
      })
      return { user, enricher }
    })
  }

  async parentSignup(dto: ParentSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.create(
        {
          email: dto.email,
          phone: dto.phone,
          name: dto.name,
          password: dto.password,
        },
        [UserRole.PARENT],
        manager,
      )

      const parentProfile = await this.parentProfilesService.ensureParentProfileForUser(
        user.id,
        manager,
      )

      await this.notificationsService.enqueue({
        userId: user.id,
        title: NotificationTemplateKeys.PARENT_WELCOME_TITLE,
        message: NotificationTemplateKeys.PARENT_WELCOME_MESSAGE,
        type: NotificationTypes.ACCOUNT_WELCOME,
        delivery: NotificationDelivery.BOTH,
        email: user.email,
        metadata: { name: user.name },
      })

      await this.notificationsService.enqueue({
        delivery: NotificationDelivery.VERIFY_EMAIL,
        userId: user.id,
        email: user.email,
        title: '',
        message: '',
      })

      return {
        user,
        parentProfile: {
          id: parentProfile.id,
          userId: parentProfile.userId,
          maxChildren: parentProfile.maxChildren,
        },
      }
    })
  }
}
