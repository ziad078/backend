import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { CreateGradeDto } from './dto/create-grade.dto'
import { UpdateGradeDto } from './dto/update-grade.dto'
import { Grade } from './entities/grade.entity'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { AdminGradeResponseDto } from './dto/admin-grade-response.dto'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface'

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    private readonly organizationsService: OrganizationsService,
  ) {}
  async create(createGradeDto: CreateGradeDto, currentUser: JwtRequestUser) {
    const org = await this.organizationsService.findOneOrFail(createGradeDto.organizationId)

    const ownedOrg = await this.organizationsService.findByOwner(currentUser.userId)
    if (ownedOrg.id !== org.id) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    await this.organizationsService.assertOrganizationApproved(org.id)

    const grade = await this.gradeRepo.save({
      ...createGradeDto,
      organization: { id: org.id },
    })
    return grade
  }

  async findAll(): Promise<AdminGradeResponseDto[]> {
    const grades = await this.gradeRepo.find({
      relations: { organization: true },
    })
    return grades.map((g) => ({
      id: g.id,
      name: g.name,
      organizationName: g.organization.organizationName,
    }))
  }

  async findOne(id: string) {
    const grade = await this.gradeRepo.findOne({
      where: { id },
      relations: { classes: { children: true } },
    })
    if (!grade) throw ApiException.notFound(ApiErrorCodes.GRADE_NOT_FOUND, { id })
    return {
      grade: {
        id: grade.id,
        name: grade.name,
        organizationId: grade.organizationId,
        classes: grade.classes,
        classesCount: grade.classes.length,
        childrenCount: grade.classes.reduce((accu, curr) => accu + curr.children.length, 0),
      },
    }
  }
  async findOneOrFail(id: string) {
    const grade = await this.gradeRepo.findOneBy({ id })
    if (!grade) throw ApiException.notFound(ApiErrorCodes.GRADE_NOT_FOUND, { id })
    return grade
  }

  async findAllByOrganization(orgId: string, currentUser: JwtRequestUser) {
    const organization = await this.organizationsService.findOneOrFail(orgId)

    if (!(await this.organizationsService.isOrgMember(currentUser.userId, orgId))) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }

    const grades = await this.gradeRepo.find({
      where: { organization },
      relations: { classes: { children: true } },
    })

    return {
      grades: grades.map((grade) => {
        return {
          id: grade.id,
          name: grade.name,
          classes: grade.classes.map((cls) => ({
            id: cls.id,
            name: cls.name,
          })),
          childrenCount: grade.classes.reduce((accu, curr) => accu + curr.children.length, 0),
        }
      }),
    }
  }
  async update(id: string, updateGradeDto: UpdateGradeDto, currentUser: JwtRequestUser) {
    const grade = await this.findOneOrFail(id)
    await this.assertCanManageGrade(grade, currentUser)

    if (updateGradeDto.name !== undefined) {
      grade.name = updateGradeDto.name
    }

    if (updateGradeDto.organizationId !== undefined) {
      const org = await this.organizationsService.findOneOrFail(updateGradeDto.organizationId)
      grade.organization = org
      grade.organizationId = org.id
    }

    return this.gradeRepo.save(grade)
  }

  async remove(id: string, currentUser: JwtRequestUser) {
    const grade = await this.findOneOrFail(id)
    await this.assertCanManageGrade(grade, currentUser)

    const result = await this.gradeRepo.delete(id)
    if (result.affected === 0) {
      throw ApiException.notFound(ApiErrorCodes.GRADE_NOT_FOUND)
    }
    return { message: 'Deleted successfully' }
  }

  private async assertCanManageGrade(grade: Grade, currentUser: JwtRequestUser) {
    if (!(await this.organizationsService.isOrgMember(currentUser.userId, grade.organizationId))) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN)
    }
    await this.organizationsService.assertOrganizationApproved(grade.organizationId)
  }
}
