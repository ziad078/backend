import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import type { JobOptions, Queue } from 'bull'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, QueryFailedError, Repository } from 'typeorm'
import { createHash } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from 'eventemitter2'
import { Payment, type PaymentMetadata } from './entities/payment.entity'
import { PaymentWebhookDedup } from './entities/payment-webhook-dedup.entity'
import { CreatePaymentDto } from './dto/create-payment.dto'
import type { CreatePaymentFields } from './types/create-payment-fields.type'
import { PaymentStatusEnum } from './enums/payment-status.enum'
import { PaymentProviderEnum } from './enums/payment-provider.enum'
import { PaymentJobName } from './enums/payment-job-name.enum'
import type { PaymentProvider } from './interfaces/payment-provider.interface'
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface'
import type {
  ProcessPaymentWebhookJobPayload,
  HandlePaymentFailureJobPayload,
  HandlePaymentSuccessJobPayload,
} from './interfaces/payment-job-payload.interface'
import {
  PAYMENT_EVENTS,
  type PaymentFailedEventPayload,
  type PaymentSuccessEventPayload,
} from './payments.events'
import { AuditLoggingService } from 'src/common/services/audit-logging.service'

const PAYMENT_QUEUE_JOB_OPTIONS: JobOptions = {
  attempts: Number(process.env.PAYMENT_JOB_ATTEMPTS ?? 8),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.PAYMENT_JOB_BACKOFF_MS ?? 2000),
  },
  removeOnComplete: Number(process.env.PAYMENT_JOB_REMOVE_ON_COMPLETE ?? 200),
  removeOnFail: Number(process.env.PAYMENT_JOB_REMOVE_ON_FAIL ?? 100),
}

function isPgUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false
  const code = (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code
  return code === '23505'
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly provider: PaymentProvider

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) providerToken: unknown,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    @InjectQueue('payment-processing')
    private readonly paymentQueue: Queue,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentWebhookDedup)
    private readonly webhookDedup: Repository<PaymentWebhookDedup>,
    private readonly auditService: AuditLoggingService,
  ) {
    this.provider = providerToken as PaymentProvider
  }

  /**
   * Class-validator DTO metadata can surface optional fields as the TS intrinsic
   * `error` type under type-aware ESLint; normalize once for safe assignments.
   */
  private normalizeCreatePaymentDto(dto: CreatePaymentDto): CreatePaymentFields {
    return dto as unknown as CreatePaymentFields
  }

  private extractProviderPaymentIdFromBody(body: unknown): string | null {
    const raw: unknown = this.provider.extractProviderPaymentId(body)
    return typeof raw === 'string' && raw.length > 0 ? raw : null
  }

  private resolveProvider(requested?: PaymentProviderEnum): PaymentProviderEnum {
    const fallback =
      (this.config.get<string>('DEFAULT_PAYMENT_PROVIDER') as PaymentProviderEnum | undefined) ??
      PaymentProviderEnum.MOYASAR
    const code = requested ?? fallback
    if (code !== this.provider.providerCode) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_INVALID_PROVIDER, `Payment provider "${code}" is not active yet. Active provider: ${this.provider.providerCode}`)
    }
    return code
  }

  private resolveExpiresAt(isPrivateExtra: boolean): Date {
    if (isPrivateExtra) {
      const minutes = Number(
        this.config.get<string>('PRIVATE_ATTEMPT_PAYMENT_EXPIRY_MINUTES') ?? 30,
      )
      return new Date(Date.now() + minutes * 60_000)
    }
    const minutes = Number(this.config.get<string>('PAYMENT_EXPIRY_MINUTES') ?? 60 * 24)
    return new Date(Date.now() + minutes * 60_000)
  }

  private maxRetriesDefault(): number {
    return Number(this.config.get<string>('PAYMENT_MAX_RETRIES') ?? 3)
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<{
    id: string
    checkoutUrl: string
    expiresAt: Date
    status: PaymentStatusEnum
  }> {
    const input = this.normalizeCreatePaymentDto(dto)
    const currency = (input.currency ?? 'SAR').toUpperCase()
    if (currency !== 'SAR') {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_CURRENCY_NOT_SUPPORTED, 'Only SAR currency is supported')
    }

    const providerCode = this.resolveProvider(input.provider)

    const childExists = await this.dataSource
      .createQueryBuilder()
      .from('private_children', 'c')
      .innerJoin('parents', 'p', 'c."parentId" = p.id')
      .where('c.id = :privateChildId', { privateChildId: input.privateChildId })
      .andWhere('p."userId" = :userId', { userId })
      .getCount()
    if (childExists < 1) {
      throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND, 'Child not found for this parent')
    }

    const metadata: PaymentMetadata = { privateChildId: input.privateChildId }
    if (input.attemptRequestId) {
      metadata.attemptRequestId = input.attemptRequestId
    }
    if (input.privateAttemptId) {
      metadata.privateAttemptId = input.privateAttemptId
    }
    if (input.description) {
      metadata.description = input.description
    }

    const amountStr = input.amount.toFixed(2)
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'

    const payment = this.payments.create({
      userId,
      privateChildId: input.privateChildId,
      privateAttemptId: input.privateAttemptId ?? null,
      paymentUrl: null,
      amount: amountStr,
      currency,
      status: PaymentStatusEnum.PENDING,
      provider: providerCode,
      providerPaymentId: null,
      metadata,
      retryCount: 0,
      maxRetries: this.maxRetriesDefault(),
      expiresAt: this.resolveExpiresAt(Boolean(input.privateAttemptId)),
    })

    const saved = (await this.payments.save(payment)) as unknown as Payment

    try {
      const session = await this.provider.createPayment({
        amount: input.amount,
        currency: 'SAR',
        clientReferenceId: saved.id,
        description: input.description,
        successUrl: `${publicUrl}/payments/complete?ref=${encodeURIComponent(saved.id)}`,
        cancelUrl: `${publicUrl}/payments/cancel?ref=${encodeURIComponent(saved.id)}`,
        metadata: metadata as Record<string, unknown>,
      })

      saved.providerPaymentId = session.providerId
      saved.paymentUrl = session.url
      ;(await this.payments.save(saved)) as unknown as Payment

      this.logger.log(`Created payment ${saved.id} (${providerCode}) session ${session.providerId}`)

      return {
        id: saved.id,
        checkoutUrl: session.url,
        expiresAt: saved.expiresAt,
        status: saved.status,
      }
    } catch (err) {
      this.logger.error(
        `Provider session failed for payment ${saved.id}`,
        err instanceof Error ? err.stack : undefined,
      )
      saved.status = PaymentStatusEnum.FAILED
      ;(await this.payments.save(saved)) as unknown as Payment
      throw err
    }
  }

  async createPaymentForPrivateExtraAttempt(
    userId: string,
    input: {
      privateChildId: string
      privateAttemptId: string
      amount: number
      description?: string
    },
  ): Promise<{
    id: string
    checkoutUrl: string
    expiresAt: Date
    status: PaymentStatusEnum
  }> {
    return this.createPayment(userId, {
      amount: input.amount,
      privateChildId: input.privateChildId,
      privateAttemptId: input.privateAttemptId,
      description: input.description,
    })
  }

  /**
   * Validates signature, deduplicates, enqueues async processing.
   */
  async handleWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ accepted: boolean; deduplicated?: boolean }> {
    try {
      this.provider.verifyWebhookSignature(rawBody, signatureHeader)
    } catch (err) {
      if (err instanceof ApiException) throw err
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID, 'Invalid webhook')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody.toString('utf8'))
    } catch {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_INVALID_JSON, 'Invalid JSON webhook body')
    }

    const providerPaymentId = this.extractProviderPaymentIdFromBody(parsed)
    if (!providerPaymentId) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_WEBHOOK_MISSING, 'Webhook payload missing payment identifier')
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex')

    try {
      await this.webhookDedup.save(this.webhookDedup.create({ providerPaymentId, payloadHash }))
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        this.logger.log(`Duplicate webhook ignored for provider payment ${providerPaymentId}`)
        return { accepted: true, deduplicated: true }
      }
      throw err
    }

    const jobPayload: ProcessPaymentWebhookJobPayload = {
      providerPaymentId,
      rawBody: rawBody.toString('utf8'),
    }

    await this.paymentQueue.add(
      PaymentJobName.PROCESS_PAYMENT_WEBHOOK,
      jobPayload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    )

    this.logger.log(`Queued ${PaymentJobName.PROCESS_PAYMENT_WEBHOOK} for ${providerPaymentId}`)

    return { accepted: true }
  }

  /**
   * Worker entry: verify with provider, persist terminal status in a transaction, chain side-effect jobs.
   */
  async runProcessPaymentWebhookJob(payload: ProcessPaymentWebhookJobPayload): Promise<void> {
    const payment = await this.payments.findOne({
      where: { providerPaymentId: payload.providerPaymentId },
    })

    if (!payment) {
      this.logger.warn(`No local payment for provider id ${payload.providerPaymentId}`)
      return
    }

    if (
      payment.status === PaymentStatusEnum.PAID ||
      payment.status === PaymentStatusEnum.FAILED ||
      payment.status === PaymentStatusEnum.EXPIRED
    ) {
      this.logger.log(
        `Payment ${payment.id} already terminal (${payment.status}), skipping webhook worker`,
      )
      return
    }

    const { status } = await this.provider.verifyPayment(payload.providerPaymentId)

    if (status === 'pending') {
      this.logger.log(`Provider reports pending for ${payment.id} — waiting for a later webhook`)
      return
    }

    const nextStatus = status === 'paid' ? PaymentStatusEnum.PAID : PaymentStatusEnum.FAILED

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Payment)
      const row = await repo.findOne({
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      })

      if (!row) return
      if (row.status !== PaymentStatusEnum.PENDING) {
        return
      }

      row.status = nextStatus
      await repo.save(row)
    })

    const fresh = await this.payments.findOne({ where: { id: payment.id } })
    if (!fresh || fresh.status !== nextStatus) {
      return
    }

    if (nextStatus === PaymentStatusEnum.PAID) {
      await this.enqueuePaymentSuccess(fresh.id)
    } else {
      await this.enqueuePaymentFailure(fresh.id, 'provider_verification_failed')
    }
  }

  private async enqueuePaymentSuccess(paymentId: string): Promise<void> {
    const payload: HandlePaymentSuccessJobPayload = { paymentId }
    await this.paymentQueue.add(
      PaymentJobName.HANDLE_PAYMENT_SUCCESS,
      payload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    )
  }

  private async enqueuePaymentFailure(paymentId: string, reason?: string): Promise<void> {
    const payload: HandlePaymentFailureJobPayload = { paymentId, reason }
    await this.paymentQueue.add(
      PaymentJobName.HANDLE_PAYMENT_FAILURE,
      payload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    )
  }

  async runHandlePaymentSuccessJob(payload: HandlePaymentSuccessJobPayload): Promise<void> {
    const payment = await this.payments.findOne({
      where: { id: payload.paymentId },
    })
    if (!payment || payment.status !== PaymentStatusEnum.PAID) {
      return
    }

    await this.auditService.logCreate(
      payment.userId,
      '',
      'SYSTEM',
      'Payment',
      payment.id,
      {
        amount: payment.amount,
        currency: payment.currency,
        status: PaymentStatusEnum.PAID,
      },
      'Payment successful',
    )

    const eventPayload: PaymentSuccessEventPayload = {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
    }

    this.logger.log(`Emitting ${PAYMENT_EVENTS.SUCCESS} for ${payment.id}`)
    this.events.emit(PAYMENT_EVENTS.SUCCESS, eventPayload)
  }

  async runHandlePaymentFailureJob(payload: HandlePaymentFailureJobPayload): Promise<void> {
    const payment = await this.payments.findOne({
      where: { id: payload.paymentId },
    })
    if (!payment) {
      return
    }

    await this.auditService.logCreate(
      payment.userId,
      '',
      'SYSTEM',
      'Payment',
      payment.id,
      {
        amount: payment.amount,
        currency: payment.currency,
        status: PaymentStatusEnum.FAILED,
        reason: payload.reason,
      },
      'Payment failed',
    )

    const eventPayload: PaymentFailedEventPayload = {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
      reason: payload.reason,
    }

    this.logger.log(`Emitting ${PAYMENT_EVENTS.FAILED} for ${payment.id}`)
    this.events.emit(PAYMENT_EVENTS.FAILED, eventPayload)
  }

  async retryPayment(
    paymentId: string,
    userId: string,
  ): Promise<{
    id: string
    checkoutUrl: string
    expiresAt: Date
    status: PaymentStatusEnum
  }> {
    const payment = await this.payments.findOne({ where: { id: paymentId } })
    if (!payment) {
      throw ApiException.notFound(ApiErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found')
    }
    if (payment.userId !== userId) {
      throw ApiException.forbidden(ApiErrorCodes.AUTH_FORBIDDEN, 'Payment does not belong to this user')
    }
    if (
      payment.status !== PaymentStatusEnum.FAILED &&
      payment.status !== PaymentStatusEnum.EXPIRED
    ) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_FAILED, 'Only failed or expired payments can be retried')
    }
    if (payment.retryCount >= payment.maxRetries) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_MAX_RETRIES, 'Maximum retries exceeded')
    }

    return this.executePaymentRetry(payment)
  }

  /**
   * Marks stale pending payments as expired. Returns number of rows updated.
   */
  async expirePayments(): Promise<number> {
    const res = await this.payments
      .createQueryBuilder()
      .update(Payment)
      .set({ status: PaymentStatusEnum.EXPIRED })
      .where('status = :pending', { pending: PaymentStatusEnum.PENDING })
      .andWhere('"expiresAt" < :now', { now: new Date() })
      .execute()

    const affected = res.affected ?? 0
    if (affected > 0) {
      this.logger.log(`Expired ${affected} pending payment(s)`)
    }
    return affected
  }

  /**
   * Optional batch auto-retry for failed payments (cooldown + cap).
   */
  async autoRetryFailedPayments(): Promise<void> {
    const cooldownMs = Number(process.env.PAYMENT_AUTO_RETRY_COOLDOWN_MS ?? 600_000)
    const staleBefore = new Date(Date.now() - cooldownMs)
    const batchSize = Number(process.env.PAYMENT_AUTO_RETRY_BATCH ?? 20)

    const candidates = await this.payments
      .createQueryBuilder('p')
      .where('p.status = :failed', { failed: PaymentStatusEnum.FAILED })
      .andWhere('p."retryCount" < p."maxRetries"')
      .andWhere('p."updatedAt" < :stale', { stale: staleBefore })
      .orderBy('p."updatedAt"', 'ASC')
      .take(batchSize)
      .getMany()

    for (const p of candidates) {
      try {
        await this.executePaymentRetry(p)
        this.logger.log(`Auto-retry scheduled new session for payment ${p.id}`)
      } catch (err) {
        this.logger.warn(
          `Auto-retry failed for payment ${p.id}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
  }

  private async executePaymentRetry(payment: Payment): Promise<{
    id: string
    checkoutUrl: string
    expiresAt: Date
    status: PaymentStatusEnum
  }> {
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'

    payment.retryCount += 1
    payment.status = PaymentStatusEnum.PENDING
    payment.expiresAt = this.resolveExpiresAt(Boolean(payment.privateAttemptId))
    payment.providerPaymentId = null
    await this.payments.save(payment)

    const amountNum = Number(payment.amount)

    try {
      const session = await this.provider.createPayment({
        amount: amountNum,
        currency: 'SAR',
        clientReferenceId: payment.id,
        description:
          typeof payment.metadata.description === 'string'
            ? payment.metadata.description
            : undefined,
        successUrl: `${publicUrl}/payments/complete?ref=${encodeURIComponent(payment.id)}`,
        cancelUrl: `${publicUrl}/payments/cancel?ref=${encodeURIComponent(payment.id)}`,
        metadata: payment.metadata as Record<string, unknown>,
      })

      payment.providerPaymentId = session.providerId
      payment.paymentUrl = session.url
      await this.payments.save(payment)

      return {
        id: payment.id,
        checkoutUrl: session.url,
        expiresAt: payment.expiresAt,
        status: payment.status,
      }
    } catch (err) {
      this.logger.error(
        `Retry provider session failed for ${payment.id}`,
        err instanceof Error ? err.stack : undefined,
      )
      payment.status = PaymentStatusEnum.FAILED
      await this.payments.save(payment)
      throw err
    }
  }
}
