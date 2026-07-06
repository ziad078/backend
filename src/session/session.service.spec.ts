import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { SessionService } from './session.service'
import { Session } from './entities/session.entity'

describe('SessionService', () => {
  let service: SessionService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService, { provide: getRepositoryToken(Session), useValue: {} }],
    }).compile()

    service = module.get(SessionService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
