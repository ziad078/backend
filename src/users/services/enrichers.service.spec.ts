import { Test, TestingModule } from '@nestjs/testing'
import { EnrichersService } from './enrichers.service'

describe('EnrichersService', () => {
  let service: EnrichersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnrichersService],
    }).compile()

    service = module.get<EnrichersService>(EnrichersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
