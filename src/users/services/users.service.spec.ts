import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UsersService } from './users.service'
import { User } from '../entities/user.entity'
import { Role } from '../entities/user-roles.entity'
import { Teacher } from '../entities/teacher.entity'

describe('UsersService', () => {
  let service: UsersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Teacher), useValue: {} },
      ],
    }).compile()

    service = module.get(UsersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
