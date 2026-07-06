import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole } from 'src/common/enums/role.enum'
import { DataSource, Repository } from 'typeorm'
import { Teacher } from '../entities/teacher.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { AuthProvider } from './auth.provider'
import { UsersService } from './users.service'
import { UpdateTeacherDto } from '../dto/update-teacher.dto'
import { Organization } from 'src/organizations/entities/organization.entity'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { ITeacherResponseDto } from '../dto/teachersDtos/teacher-response.dto'
import { CreateTeacherDto } from '../dto/teachersDtos/create-teacher.dto'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'

@Injectable()
export class TeachersProvider {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly authService: AuthProvider,
    private readonly orgService: OrganizationsService,
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
  ) {}
  async create(dto: CreateTeacherDto, currentUser: JwtRequestUser) {
    return this.dataSource.transaction(async (manager) => {
      const isExits = await this.authService.isAlreadyExits(dto.phone, dto.email)
      if (isExits) throw new ConflictException('teacher already exits')
      const organization = await this.orgService.findByOwner(currentUser.userId)
      await this.orgService.assertOrganizationApproved(organization.id)
      const user = await this.usersService.create(
        {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          password: dto.password,
        },
        [UserRole.TEACHER],
        manager,
      )

      const teacher = manager.create(Teacher, {
        jobTitle: dto.jobTitle,
        organization,
        user,
      })

      await manager.save(teacher)

      return { teacher }
    })
  }

  async update(id: string, updateTeacherDto: UpdateTeacherDto, currentUser: JwtRequestUser) {
    const teacher = await this.dataSource.getRepository(Teacher).findOne({
      where: { id },
      relations: ['user', 'organization'],
    })

    if (!teacher) throw new NotFoundException('Teacher not found')

    if (!(await this.orgService.isOrgMember(currentUser.userId, teacher.organization.id))) {
      throw new ForbiddenException('You do not have access to this teacher')
    }
    await this.orgService.assertOrganizationApproved(teacher.organization.id)

    // لو فيه organizationId جديد
    if (updateTeacherDto.organizationId) {
      const org = await this.dataSource
        .getRepository(Organization)
        .findOne({ where: { id: updateTeacherDto.organizationId } })
      if (!org) throw new NotFoundException('Organization not found')

      teacher.organization = org
    }

    if (updateTeacherDto.jobTitle) teacher.jobTitle = updateTeacherDto.jobTitle

    if (updateTeacherDto.name) teacher.user.name = updateTeacherDto.name

    return this.dataSource.getRepository(Teacher).save(teacher)
  }

  async findAllByOrganization(
    organizationId: string,
    currentUser: JwtRequestUser,
  ): Promise<{
    teachers: ITeacherResponseDto[]
  }> {
    if (!(await this.orgService.isOrgMember(currentUser.userId, organizationId))) {
      throw new ForbiddenException('You do not have access to this organization')
    }

    const organization = await this.dataSource.getRepository(Organization).findOne({
      where: { id: organizationId },
    })
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    const teachers = await this.teacherRepo.find({
      where: { organization: { id: organizationId } },
      relations: ['user', 'organization', 'classes'],
    })

    return {
      teachers: teachers.map((t) => {
        return {
          email: t.user.email,
          phone: t.user.phone,
          classes: t.classes.map((c) => c.name),
          userId: t.user.id,
          teacherId: t.id,
          isEmailVerified: t.user.isEmailVerified,
          isPhoneVerified: t.user.isPhoneVerified,
          jobTitle: t.jobTitle,
          name: t.user.name,
          organizationId: t.organization.id,
          organizationName: t.organization.organizationName,
        }
      }),
    }
  }

  async remove(id: string, currentUser: JwtRequestUser) {
    const teacher = await this.teacherRepo.findOne({
      where: { id },
      relations: ['organization', 'user'],
    })
    if (!teacher) throw new NotFoundException('Teacher not found')

    if (!(await this.orgService.isOrgMember(currentUser.userId, teacher.organization.id))) {
      throw new ForbiddenException('You do not have access to this teacher')
    }
    await this.orgService.assertOrganizationApproved(teacher.organization.id)

    await this.teacherRepo.delete(id)
    return this.usersService.remove(teacher.user.id)
  }
}
