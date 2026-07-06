import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { GradesService } from './grades.service'
import { Grade } from './entities/grade.entity'
import { OrganizationsService } from 'src/organizations/organizations.service'

describe('GradesService', () => {
  let service: GradesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        { provide: getRepositoryToken(Grade), useValue: {} },
        { provide: OrganizationsService, useValue: {} },
      ],
    }).compile()

    service = module.get(GradesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
