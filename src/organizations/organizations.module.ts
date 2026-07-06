import { Module } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { OrganizationsController } from './organizations.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Organization } from './entities/organization.entity'

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  imports: [TypeOrmModule.forFeature([Organization])],
  exports: [TypeOrmModule, OrganizationsService],
})
export class OrganizationsModule {}
