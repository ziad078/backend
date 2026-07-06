import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ClassesService } from 'src/classes/classes.service'
import { AttemptUsageService } from 'src/evaluations/attempt-usage.service'
import { NotificationsService } from 'src/notifications/notifications.service'
import { OrganizationsService } from 'src/organizations/organizations.service'
import { UsersService } from 'src/users/services/users.service'
import { ParentProfilesService } from 'src/users/services/parent-profiles.service'
import { DataSource } from 'typeorm'
import { OrganizationChild } from './entities/organization-child.entity'
import { PrivateChild } from './entities/private-child.entity'
import { ChildrenService } from './children.service'
import { TransferService } from './transfer.service'
import { ChildAccessPolicy } from './services/child-access-policy.service'

describe('ChildrenService', () => {
  let service: ChildrenService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildrenService,
        { provide: getRepositoryToken(OrganizationChild), useValue: {} },
        { provide: getRepositoryToken(PrivateChild), useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: ClassesService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: AttemptUsageService, useValue: {} },
        { provide: TransferService, useValue: {} },
        { provide: ChildAccessPolicy, useValue: {} },
        { provide: ParentProfilesService, useValue: {} },
      ],
    }).compile()

    service = module.get<ChildrenService>(ChildrenService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
