import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Enricher } from '../entities/enricher.entity'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'

@Injectable()
export class EnrichersService {
  constructor(
    @InjectRepository(Enricher)
    private readonly enrichersRepository: Repository<Enricher>,
  ) {}

  async assertEnricherApproved(userId: string): Promise<Enricher> {
    const enricher = await this.enrichersRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    })

    if (!enricher) {
      throw ApiException.notFound(ApiErrorCodes.USER_NOT_FOUND)
    }

    if (enricher.approvalStatus !== ApprovalStatus.APPROVED) {
      throw ApiException.forbidden(ApiErrorCodes.ORGANIZATION_NOT_APPROVED, {
        entity: 'enricher',
        status: enricher.approvalStatus,
      })
    }

    return enricher
  }
}
