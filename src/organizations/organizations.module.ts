import { Module } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { OrganizationsController } from './organizations.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Organization } from './entities/organization.entity'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  imports: [TypeOrmModule.forFeature([Organization, ParentProfile])],
  exports: [TypeOrmModule, OrganizationsService],
})
export class OrganizationsModule {}
