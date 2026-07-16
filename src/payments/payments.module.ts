import { forwardRef, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Payment } from './entities/payment.entity'
import { PaymentWebhookDedup } from './entities/payment-webhook-dedup.entity'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { PaymentProcessingProcessor } from './processors/payment-processing.processor'
import { PaymobProvider } from './providers/paymob.provider'
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface'
import { PaymentsCronService } from './payments.cron'
import { EvaluationsModule } from 'src/evaluations/evaluations.module'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'
import { AuditLog } from 'src/common/entities/audit-log.entity'
import { PaymentSessionService } from './application/payment-session.service'
import { CapacityPaymentCompletionHandler } from './handlers/capacity-payment-completion.handler'
import { CapacityRequest } from 'src/capacity/entities/capacity-request.entity'
import { NotificationsModule } from 'src/notifications/notifications.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentWebhookDedup, AuditLog, CapacityRequest]),
    BullModule.registerQueue({
      name: 'payment-processing',
    }),
    forwardRef(() => EvaluationsModule),
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentSessionService,
    PaymentProcessingProcessor,
    PaymentsCronService,
    PaymobProvider,
    CapacityPaymentCompletionHandler,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: PaymobProvider,
    },
    AuditLoggingService,
  ],
  exports: [PaymentsService, PaymentSessionService],
})
export class PaymentsModule {}
