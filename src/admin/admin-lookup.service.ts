import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'
import { buildPaginationMeta } from 'src/common/dto/pagination-query.dto'
import { LookupOptionDto } from 'src/common/dto/lookup-option.dto'
import { SearchPaginationQueryDto } from 'src/common/dto/search-pagination-query.dto'
import { User } from 'src/users/entities/user.entity'
import { Evaluation } from 'src/evaluations/entities/evaluation.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { ChildLookupType } from './dto/lookup-children-query.dto'

@Injectable()
export class AdminLookupService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,
    @InjectRepository(OrganizationChild)
    private readonly orgChildRepo: Repository<OrganizationChild>,
    @InjectRepository(PrivateChild)
    private readonly privateChildRepo: Repository<PrivateChild>,
  ) {}

  async lookupUsers(query: SearchPaginationQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const qb = this.userRepo.createQueryBuilder('user').orderBy('user.name', 'ASC')

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('user.name ILIKE :term', { term })
            .orWhere('user.email ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term })
            .orWhere('CAST(user.id AS text) ILIKE :term', { term })
        }),
      )
    }

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const data: LookupOptionDto[] = users.map((user) => ({
      id: user.id,
      label: user.name,
      description: user.email ?? user.phone ?? undefined,
    }))

    return { data, meta: buildPaginationMeta(page, limit, total) }
  }

  async lookupEvaluations(query: SearchPaginationQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const qb = this.evaluationRepo.createQueryBuilder('evaluation').orderBy('evaluation.title', 'ASC')

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('evaluation.title ILIKE :term', { term })
            .orWhere('CAST(evaluation.id AS text) ILIKE :term', { term })
        }),
      )
    }

    const [evaluations, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const data: LookupOptionDto[] = evaluations.map((evaluation) => ({
      id: evaluation.id,
      label: evaluation.title,
      description: evaluation.type ?? undefined,
    }))

    return { data, meta: buildPaginationMeta(page, limit, total) }
  }

  async lookupChildren(query: SearchPaginationQueryDto & { type?: ChildLookupType }) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const type = query.type ?? ChildLookupType.ALL
    const search = query.search?.trim()

    if (type === ChildLookupType.ORGANIZATION) {
      return this.lookupOrganizationChildren(page, limit, search)
    }

    if (type === ChildLookupType.PRIVATE) {
      return this.lookupPrivateChildren(page, limit, search)
    }

    const orgResult = await this.lookupOrganizationChildren(page, limit, search)
    if (orgResult.data.length >= limit) {
      return orgResult
    }

    const remaining = limit - orgResult.data.length
    const privateResult = await this.lookupPrivateChildren(1, remaining, search)
    return {
      data: [...orgResult.data, ...privateResult.data],
      meta: buildPaginationMeta(page, limit, orgResult.meta.total + privateResult.meta.total),
    }
  }

  private async lookupOrganizationChildren(page: number, limit: number, search?: string) {
    const qb = this.orgChildRepo
      .createQueryBuilder('child')
      .leftJoinAndSelect('child.organization', 'organization')
      .orderBy('child.name', 'ASC')

    if (search) {
      const term = `%${search}%`
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('child.name ILIKE :term', { term })
            .orWhere('organization.organizationName ILIKE :term', { term })
            .orWhere('CAST(child.id AS text) ILIKE :term', { term })
        }),
      )
    }

    const [children, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const data: LookupOptionDto[] = children.map((child) => ({
      id: child.id,
      label: child.name,
      description: child.organization?.organizationName ?? undefined,
    }))

    return { data, meta: buildPaginationMeta(page, limit, total) }
  }

  private async lookupPrivateChildren(page: number, limit: number, search?: string) {
    const qb = this.privateChildRepo
      .createQueryBuilder('child')
      .leftJoinAndSelect('child.parent', 'parent')
      .orderBy('child.name', 'ASC')

    if (search) {
      const term = `%${search}%`
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('child.name ILIKE :term', { term })
            .orWhere('CAST(child.id AS text) ILIKE :term', { term })
        }),
      )
    }

    const [children, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const data: LookupOptionDto[] = children.map((child) => ({
      id: child.id,
      label: child.name,
      description: undefined,
    }))

    return { data, meta: buildPaginationMeta(page, limit, total) }
  }
}
