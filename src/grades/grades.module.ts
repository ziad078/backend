import { Module } from '@nestjs/common'
import { GradesService } from './grades.service'
import { GradesController } from './grades.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Grade } from './entities/grade.entity'
import { OrganizationsModule } from 'src/organizations/organizations.module'

@Module({
  controllers: [GradesController],
  providers: [GradesService],
  imports: [TypeOrmModule.forFeature([Grade]), OrganizationsModule],
  exports: [TypeOrmModule, GradesService],
})
export class GradesModule {}
