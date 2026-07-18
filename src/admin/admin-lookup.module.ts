import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from 'src/users/entities/user.entity'
import { Evaluation } from 'src/evaluations/entities/evaluation.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { AdminLookupController } from './admin-lookup.controller'
import { AdminLookupService } from './admin-lookup.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, Evaluation, OrganizationChild, PrivateChild])],
  controllers: [AdminLookupController],
  providers: [AdminLookupService],
  exports: [AdminLookupService],
})
export class AdminLookupModule {}
