import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CapacityRequest } from './entities/capacity-request.entity'
import { CapacityRequestService } from './capacity-request.service'
import { CapacityRequestController } from './capacity-request.controller'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'

@Module({
  imports: [TypeOrmModule.forFeature([CapacityRequest, ParentProfile])],
  controllers: [CapacityRequestController],
  providers: [CapacityRequestService],
  exports: [TypeOrmModule, CapacityRequestService],
})
export class CapacityModule {}
