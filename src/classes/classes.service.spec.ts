import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ClassesService } from './classes.service'
import { Class } from './entities/class.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { GradesService } from 'src/grades/grades.service'
import { ChildrenService } from 'src/children/children.service'
import { OrganizationsService } from 'src/organizations/organizations.service'

describe('ClassesService', () => {
  let service: ClassesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: getRepositoryToken(Class), useValue: {} },
        { provide: getRepositoryToken(Teacher), useValue: {} },
        { provide: GradesService, useValue: {} },
        { provide: ChildrenService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
      ],
    }).compile()

    service = module.get(ClassesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
