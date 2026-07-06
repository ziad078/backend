import { Process, Processor, OnQueueFailed } from '@nestjs/bull'
import type { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { PaymentJobName } from '../enums/payment-job-name.enum'
import type {
  ProcessPaymentWebhookJobPayload,
  HandlePaymentSuccessJobPayload,
  HandlePaymentFailureJobPayload,
} from '../interfaces/payment-job-payload.interface'
import { PaymentsService } from '../payments.service'

@Processor('payment-processing')
export class PaymentProcessingProcessor {
  private readonly logger = new Logger(PaymentProcessingProcessor.name)

  constructor(private readonly payments: PaymentsService) {}

  @OnQueueFailed({ name: PaymentJobName.PROCESS_PAYMENT_WEBHOOK })
  onWebhookFailed(job: Job<ProcessPaymentWebhookJobPayload>, err: Error) {
    this.logger.error(
      `Webhook job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`,
      err.stack,
    )
  }

  @OnQueueFailed({ name: PaymentJobName.HANDLE_PAYMENT_SUCCESS })
  onSuccessFailed(job: Job<HandlePaymentSuccessJobPayload>, err: Error) {
    this.logger.error(`Success handler job ${job.id} failed: ${err.message}`, err.stack)
  }

  @OnQueueFailed({ name: PaymentJobName.HANDLE_PAYMENT_FAILURE })
  onFailureFailed(job: Job<HandlePaymentFailureJobPayload>, err: Error) {
    this.logger.error(`Failure handler job ${job.id} failed: ${err.message}`, err.stack)
  }

  @Process({
    name: PaymentJobName.PROCESS_PAYMENT_WEBHOOK,
    concurrency: Number(process.env.PAYMENT_WEBHOOK_CONCURRENCY ?? 5),
  })
  async handleWebhook(job: Job<ProcessPaymentWebhookJobPayload>): Promise<void> {
    await this.payments.runProcessPaymentWebhookJob(job.data)
  }

  @Process({
    name: PaymentJobName.HANDLE_PAYMENT_SUCCESS,
    concurrency: Number(process.env.PAYMENT_SUCCESS_CONCURRENCY ?? 10),
  })
  async handleSuccess(job: Job<HandlePaymentSuccessJobPayload>): Promise<void> {
    await this.payments.runHandlePaymentSuccessJob(job.data)
  }

  @Process({
    name: PaymentJobName.HANDLE_PAYMENT_FAILURE,
    concurrency: Number(process.env.PAYMENT_FAILURE_CONCURRENCY ?? 10),
  })
  async handleFailure(job: Job<HandlePaymentFailureJobPayload>): Promise<void> {
    await this.payments.runHandlePaymentFailureJob(job.data)
  }
}
