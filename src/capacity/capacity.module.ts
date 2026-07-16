import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CapacityRequest } from './entities/capacity-request.entity'
import { CapacityRequestService } from './capacity-request.service'
import { CapacityRequestController } from './capacity-request.controller'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { PaymentsModule } from 'src/payments/payments.module'
import { NotificationsModule } from 'src/notifications/notifications.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([CapacityRequest, ParentProfile]),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [CapacityRequestController],
  providers: [CapacityRequestService],
  exports: [TypeOrmModule, CapacityRequestService],
})
export class CapacityModule {}
