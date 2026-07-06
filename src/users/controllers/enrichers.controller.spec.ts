import { Test, TestingModule } from '@nestjs/testing'
import { EnrichersController } from './enrichers.controller'
import { EnrichersService } from '../services/enrichers.service'

describe('EnrichersController', () => {
  let controller: EnrichersController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrichersController],
      providers: [{ provide: EnrichersService, useValue: {} }],
    }).compile()

    controller = module.get<EnrichersController>(EnrichersController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
