import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { EnrichersService } from './enrichers.service'
import { Enricher } from '../entities/enricher.entity'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { ApiException } from 'src/common/exceptions/api.exception'

describe('EnrichersService', () => {
  let service: EnrichersService

  const enrichersRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichersService,
        {
          provide: getRepositoryToken(Enricher),
          useValue: enrichersRepository,
        },
      ],
    }).compile()

    service = module.get<EnrichersService>(EnrichersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('throws when enricher is not approved', async () => {
    enrichersRepository.findOne.mockResolvedValue({
      id: 'e1',
      approvalStatus: ApprovalStatus.PENDING,
      user: { id: 'u1' },
    })

    await expect(service.assertEnricherApproved('u1')).rejects.toBeInstanceOf(ApiException)
  })

  it('returns enricher when approved', async () => {
    const enricher = {
      id: 'e1',
      approvalStatus: ApprovalStatus.APPROVED,
      user: { id: 'u1' },
    }
    enrichersRepository.findOne.mockResolvedValue(enricher)

    await expect(service.assertEnricherApproved('u1')).resolves.toEqual(enricher)
  })
})
