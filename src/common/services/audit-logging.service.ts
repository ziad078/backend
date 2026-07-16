import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../entities/audit-log.entity'
import { AuditAction } from '../enums/audit-action.enum'
import { Request } from 'express'
import { ListAuditLogsDto } from '../dto/list-audit-logs.dto'
import { buildPaginationMeta } from '../dto/pagination-query.dto'

export interface AuditLogOptions {
  userId: string
  userEmail: string
  userRole: string
  action: AuditAction
  entityType: string
  entityId: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  description?: string | null
  request?: Request
}

@Injectable()
export class AuditLoggingService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(options: AuditLogOptions): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      userId: options.userId,
      userEmail: options.userEmail,
      userRole: options.userRole,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      oldValue: options.oldValue || null,
      newValue: options.newValue || null,
      description: options.description || null,
      ipAddress: this.extractIpAddress(options.request),
      userAgent: this.extractUserAgent(options.request),
    })

    await this.auditLogRepository.save(auditLog)
  }

  async logCreate(
    userId: string,
    userEmail: string,
    userRole: string,
    entityType: string,
    entityId: string,
    newValue: Record<string, unknown>,
    description?: string,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      action: AuditAction.CREATE,
      entityType,
      entityId,
      newValue,
      description,
      request,
    })
  }

  async logUpdate(
    userId: string,
    userEmail: string,
    userRole: string,
    entityType: string,
    entityId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    description?: string,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      oldValue,
      newValue,
      description,
      request,
    })
  }

  async logDelete(
    userId: string,
    userEmail: string,
    userRole: string,
    entityType: string,
    entityId: string,
    oldValue: Record<string, unknown>,
    description?: string,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      action: AuditAction.DELETE,
      entityType,
      entityId,
      oldValue,
      description,
      request,
    })
  }

  async logApprove(
    userId: string,
    userEmail: string,
    userRole: string,
    entityType: string,
    entityId: string,
    description?: string,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      action: AuditAction.APPROVE,
      entityType,
      entityId,
      description,
      request,
    })
  }

  async logReject(
    userId: string,
    userEmail: string,
    userRole: string,
    entityType: string,
    entityId: string,
    description?: string,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      action: AuditAction.REJECT,
      entityType,
      entityId,
      description,
      request,
    })
  }

  async getAuditLogsForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    })
  }

  async getAuditLogsForUser(userId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
  }

  async list(query: ListAuditLogsDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    if (query.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: query.entityType })
    }
    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId })
    }
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId })
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action })
    }

    const [data, total] = await qb.getManyAndCount()

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    }
  }

  private extractIpAddress(request?: Request): string | null {
    if (!request) return null
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.socket.remoteAddress ||
      null
    )
  }

  private extractUserAgent(request?: Request): string | null {
    if (!request) return null
    return (request.headers['user-agent'] as string) || null
  }
}
