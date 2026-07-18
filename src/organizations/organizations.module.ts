import { Module } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { OrganizationDashboardService } from './organization-dashboard.service'
import { OrganizationsController } from './organizations.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Organization } from './entities/organization.entity'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { Grade } from 'src/grades/entities/grade.entity'
import { Class } from 'src/classes/entities/class.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { EvaluationAttempt } from 'src/evaluations/entities/evaluation-attempt.entity'
import { AuditLog } from 'src/common/entities/audit-log.entity'

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationDashboardService],
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      ParentProfile,
      Grade,
      Class,
      Teacher,
      OrganizationChild,
      EvaluationAttempt,
      AuditLog,
    ]),
  ],
  exports: [TypeOrmModule, OrganizationsService, OrganizationDashboardService],
})
export class OrganizationsModule {}
