import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NotificationsModule } from 'src/notifications/notifications.module'
import { Organization } from 'src/organizations/entities/organization.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { User } from 'src/users/entities/user.entity'
import { ActivitiesController } from './activities.controller'
import { ActivitiesService } from './activities.service'
import { DealsController } from './deals.controller'
import { DealsService } from './deals.service'
import { ProposalsController } from './proposals.controller'
import { Activity } from './entities/activity.entity'
import { Deal } from './entities/deal.entity'
import { Proposal } from './entities/proposal.entity'
import { IsFutureDateConstraint } from './dto/create-deal.dto'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { AuditLog } from 'src/common/entities/audit-log.entity'
import { DealAccessPolicy } from './policies/deal-access.policy'
import { OrganizationsModule } from 'src/organizations/organizations.module'
import { UsersModule } from 'src/users/users.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Deal, Proposal, Activity, User, Organization, Teacher, AuditLog]),
    NotificationsModule,
    forwardRef(() => OrganizationsModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [DealsController, ProposalsController, ActivitiesController],
  providers: [
    DealsService,
    ActivitiesService,
    IsFutureDateConstraint,
    AuditLoggingService,
    DealAccessPolicy,
  ],
  exports: [DealsService],
})
export class DealsModule {}
