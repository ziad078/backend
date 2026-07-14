import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, Not, Repository } from 'typeorm'
import { UserRole } from 'src/common/enums/role.enum'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { CreateUserDto } from '../dto/create-user.dto'
import { UpdateUserDto } from '../dto/update-user.dto'
import { IUserResponseDto } from '../dto/user-response.dto'
import { Role } from '../entities/user-roles.entity'
import { User } from '../entities/user.entity'
import { Teacher } from '../entities/teacher.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  onModuleInit() {
    return this.seedRoles()
  }
  async create(dto: CreateUserDto, roles: UserRole[], manager: EntityManager) {
    const hashed = await bcrypt.hash(dto.password, 10)
    const dbRoles = await manager.getRepository(Role).find({
      where: roles.map((r) => ({ name: r })),
    })
    const user = manager.create(User, {
      ...dto,
      password: hashed,
      roles: dbRoles,
    })
    return manager.save(user)
  }

  seedRoles() {
    const ROLES = [
      UserRole.ADMIN,
      UserRole.ORGANIZATIONOWNER,
      UserRole.PARENT,
      UserRole.TEACHER,
      UserRole.ENRICHER,
    ]
    return this.roleRepo.upsert(
      ROLES.map((name) => ({ name })),
      { conflictPaths: ['name'] },
    )
  }
  async findAll(): Promise<{ users: IUserResponseDto[] }> {
    return { users: await this.userRepo.find() }
  }

  async findUsersByRoles() {
    const users = await this.userRepo.find({ relations: ['enricher'] })
    const teachers = users.filter((user) => user.roles.some((r) => r.name === UserRole.TEACHER))
    const organizationOwners = users.filter((user) =>
      user.roles.some((r) => r.name === UserRole.ORGANIZATIONOWNER),
    )
    const enrichers = users.filter((user) => user.roles.some((r) => r.name === UserRole.ENRICHER))
    return {
      teachers,
      organizationOwners,
      enrichers,
    }
  }

  async getOrganizationOwner(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['ownedOrganization'],
    })
    return { user }
  }

  async findById(id: string) {
    const user = await this.userRepo.findOneBy({ id })
    if (!user) throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    return user
  }
  async findTeacher(id: string) {
    const user = await this.teacherRepo.findOne({ where: { user: { id } } })
    if (!user) throw ApiException.notFound(ApiErrorCodes.TEACHER_NOT_FOUND)
    return user
  }
  async findByPhone(phone: string) {
    return this.userRepo.findOneBy({ phone })
  }
  async findByEmail(email: string) {
    return this.userRepo.findOneBy({ email })
  }

  async updateUser(id: string, dto: UpdateUserDto, manager?: EntityManager): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this.userRepo

    const user = await repo.findOne({ where: { id }, relations: ['roles'] })
    if (!user) throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)

    if (dto.name !== undefined) user.name = dto.name

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim()
      const emailTaken = await repo.exists({
        where: { email, id: Not(id) },
      })
      if (emailTaken) {
        throw ApiException.conflict(ApiErrorCodes.USER_EMAIL_IN_USE)
      }
      user.email = email
    }

    if (dto.phone !== undefined) {
      const phoneTaken = await repo.exists({
        where: { phone: dto.phone, id: Not(id) },
      })
      if (phoneTaken) {
        throw ApiException.conflict(ApiErrorCodes.USER_PHONE_IN_USE)
      }
      user.phone = dto.phone
    }

    if (dto.password !== undefined) {
      user.password = await bcrypt.hash(dto.password, 10)
    }

    return repo.save(user)
  }

  async addRolesToUser(
    userId: string,
    roleNames: UserRole[],
    manager?: EntityManager,
  ): Promise<User> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo
    const roleRepo = manager ? manager.getRepository(Role) : this.roleRepo

    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    })
    if (!user) throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)

    const existingNames = new Set(user.roles.map((r) => r.name))
    const toAdd = roleNames.filter((name) => !existingNames.has(name))
    if (toAdd.length === 0) {
      return user
    }

    const dbRoles = await roleRepo.find({ where: { name: In(toAdd) } })
    user.roles = [...user.roles, ...dbRoles]
    return userRepo.save(user)
  }

  async removeRolesFromUser(
    userId: string,
    roleNames: UserRole[],
    manager?: EntityManager,
  ): Promise<User> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo

    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    })
    if (!user) throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)

    const remove = new Set(roleNames)
    user.roles = user.roles.filter((r) => !remove.has(r.name))
    return userRepo.save(user)
  }

  save(user: User) {
    return this.userRepo.save(user)
  }

  async remove(id: string) {
    const result = await this.userRepo.delete({ id })

    if (result.affected === 0) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    return { message: 'Deleted successfully' }
  }
}
