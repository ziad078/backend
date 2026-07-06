import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PaymentsService } from './payments.service'

@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name)

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStalePayments(): Promise<void> {
    try {
      await this.payments.expirePayments()
    } catch (err) {
      this.logger.error(
        `expireStalePayments failed: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      )
    }
  }

  /** Every 15 minutes (Nest CronExpression has no EVERY_15_MINUTES preset). */
  @Cron('0 */15 * * * *')
  async autoRetryFailedPayments(): Promise<void> {
    if (process.env.PAYMENT_AUTO_RETRY_ENABLED === 'false') {
      return
    }
    try {
      await this.payments.autoRetryFailedPayments()
    } catch (err) {
      this.logger.error(
        `autoRetryFailedPayments failed: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      )
    }
  }
}
