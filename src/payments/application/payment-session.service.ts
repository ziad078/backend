import { Injectable, Logger, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { DataSource, Repository } from 'typeorm'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { Payment, type PaymentMetadata } from '../entities/payment.entity'
import { PaymentStatusEnum } from '../enums/payment-status.enum'
import { PaymentProviderEnum } from '../enums/payment-provider.enum'
import { PaymentPurpose } from '../enums/payment-purpose.enum'
import type { PaymentProvider } from '../interfaces/payment-provider.interface'
import { PAYMENT_PROVIDER } from '../interfaces/payment-provider.interface'
import type { CreatePaymentProviderInput } from '../interfaces/payment-provider.interface'

export type PaymentSessionResult = {
  id: string
  checkoutUrl: string
  expiresAt: Date
  status: PaymentStatusEnum
}

export type CreatePaymentSessionInput = {
  userId: string
  amount: number
  purpose: PaymentPurpose
  metadata: PaymentMetadata
  description?: string
  privateChildId?: string | null
  privateAttemptId?: string | null
  billingData?: CreatePaymentProviderInput['billingData']
  expiryMinutes?: number
}

@Injectable()
export class PaymentSessionService {
  private readonly logger = new Logger(PaymentSessionService.name)
  private readonly provider: PaymentProvider

  constructor(
    @Inject(PAYMENT_PROVIDER) providerToken: unknown,
    private readonly config: ConfigService,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {
    this.provider = providerToken as PaymentProvider
  }

  async createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    const currency = 'SAR'
    const amountStr = input.amount.toFixed(2)
    const providerCode = this.resolveProvider()
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'

    await this.validateSessionInput(input)

    const metadata: PaymentMetadata = {
      ...input.metadata,
      purpose: input.purpose,
      description: input.description ?? input.metadata.description,
    }

    const payment = this.payments.create({
      userId: input.userId,
      privateChildId: input.privateChildId ?? null,
      privateAttemptId: input.privateAttemptId ?? null,
      paymentUrl: null,
      amount: amountStr,
      currency,
      status: PaymentStatusEnum.PENDING,
      provider: providerCode,
      providerPaymentId: null,
      metadata,
      retryCount: 0,
      maxRetries: Number(this.config.get<string>('PAYMENT_MAX_RETRIES') ?? 3),
      expiresAt: this.resolveExpiresAt(input),
    })

    const saved = await this.payments.save(payment)

    try {
      const session = await this.provider.createPayment({
        amount: input.amount,
        currency: 'SAR',
        clientReferenceId: saved.id,
        description: input.description,
        successUrl: `${publicUrl}/payments/complete?ref=${encodeURIComponent(saved.id)}`,
        cancelUrl: `${publicUrl}/payments/cancel?ref=${encodeURIComponent(saved.id)}`,
        metadata: metadata as Record<string, unknown>,
        billingData: input.billingData,
      })

      saved.providerPaymentId = session.providerId
      saved.paymentUrl = session.url
      await this.payments.save(saved)

      this.logger.log(`Created payment session ${saved.id} (${input.purpose})`)

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
      await this.payments.save(saved)
      throw err
    }
  }

  async refreshSession(payment: Payment): Promise<PaymentSessionResult> {
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'

    payment.retryCount += 1
    payment.status = PaymentStatusEnum.PENDING
    payment.expiresAt = this.resolveExpiresAtFromPayment(payment)
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
      payment.status = PaymentStatusEnum.FAILED
      await this.payments.save(payment)
      throw err
    }
  }

  private resolveProvider(): PaymentProviderEnum {
    const fallback =
      (this.config.get<string>('DEFAULT_PAYMENT_PROVIDER') as PaymentProviderEnum | undefined) ??
      PaymentProviderEnum.PAYMOB
    if (fallback !== this.provider.providerCode) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_INVALID_PROVIDER, {
        providerCode: fallback,
        activeProvider: this.provider.providerCode,
      })
    }
    return fallback
  }

  private resolveExpiresAt(input: CreatePaymentSessionInput): Date {
    const minutes =
      input.expiryMinutes ??
      (input.purpose === PaymentPurpose.PRIVATE_EXTRA_ATTEMPT
        ? Number(this.config.get<string>('PRIVATE_ATTEMPT_PAYMENT_EXPIRY_MINUTES') ?? 30)
        : Number(this.config.get<string>('PAYMENT_EXPIRY_MINUTES') ?? 60 * 24))
    return new Date(Date.now() + minutes * 60_000)
  }

  private resolveExpiresAtFromPayment(payment: Payment): Date {
    const isPrivateExtra = Boolean(payment.privateAttemptId)
    const minutes = isPrivateExtra
      ? Number(this.config.get<string>('PRIVATE_ATTEMPT_PAYMENT_EXPIRY_MINUTES') ?? 30)
      : Number(this.config.get<string>('PAYMENT_EXPIRY_MINUTES') ?? 60 * 24)
    return new Date(Date.now() + minutes * 60_000)
  }

  private async validateSessionInput(input: CreatePaymentSessionInput): Promise<void> {
    if (input.purpose === PaymentPurpose.PRIVATE_EXTRA_ATTEMPT) {
      if (!input.privateChildId) {
        throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
      }

      const childExists = await this.dataSource
        .createQueryBuilder()
        .from('private_children', 'c')
        .innerJoin('parents', 'p', 'c."parentId" = p.id')
        .where('c.id = :privateChildId', { privateChildId: input.privateChildId })
        .andWhere('p."userId" = :userId', { userId: input.userId })
        .getCount()

      if (childExists < 1) {
        throw ApiException.forbidden(ApiErrorCodes.CHILD_NOT_FOUND)
      }
    }

    if (input.purpose === PaymentPurpose.CAPACITY_INCREASE) {
      if (!input.metadata.capacityRequestId) {
        throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED)
      }
    }
  }
}
