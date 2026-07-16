import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { randomUUID } from 'crypto'
import type {
  CreatePaymentProviderInput,
  CreatePaymentProviderResult,
  ParsedPaymentWebhook,
  PaymentProvider,
  PaymentVerificationResult,
  PaymentWebhookContext,
} from '../interfaces/payment-provider.interface'
import { PaymentProviderEnum } from '../enums/payment-provider.enum'
import { verifyPaymobTransactionHmac } from './paymob-hmac.util'

type PaymobIntentionResponse = {
  id?: string | number
  client_secret?: string
  intention_order_id?: number
}

type PaymobTransactionObj = Record<string, unknown>

@Injectable()
export class PaymobProvider implements PaymentProvider {
  readonly providerCode = PaymentProviderEnum.PAYMOB
  private readonly logger = new Logger(PaymobProvider.name)

  constructor(private readonly config: ConfigService) {}

  private get apiBase(): string {
    return this.config.get<string>('PAYMOB_API_BASE')?.replace(/\/$/, '') ?? 'https://accept.paymob.com'
  }

  private get secretKey(): string | undefined {
    return this.config.get<string>('PAYMOB_SECRET_KEY')?.trim()
  }

  private get publicKey(): string | undefined {
    return this.config.get<string>('PAYMOB_PUBLIC_KEY')?.trim()
  }

  private get hmacSecret(): string | undefined {
    return this.config.get<string>('PAYMOB_HMAC_SECRET')?.trim()
  }

  private get integrationId(): number | undefined {
    const raw = this.config.get<string>('PAYMOB_INTEGRATION_ID')
    if (!raw?.trim()) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private get notificationUrl(): string {
    const apiBase =
      this.config.get<string>('API_PUBLIC_URL')?.replace(/\/$/, '') ??
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ??
      'http://localhost:3001'
    return `${apiBase}/api/payments/webhook/paymob`
  }

  verifyWebhookSignature(rawBody: Buffer, context: PaymentWebhookContext): void {
    const hmacSecret = this.hmacSecret
    if (!hmacSecret) {
      this.logger.error('PAYMOB_HMAC_SECRET is not configured')
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID)
    }

    const receivedHmac = context.query?.hmac?.trim()
    if (!receivedHmac) {
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody.toString('utf8'))
    } catch {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_INVALID_JSON)
    }

    const webhook = this.parseWebhookPayload(parsed)
    if (!webhook) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_WEBHOOK_MISSING)
    }

    const obj = this.extractTransactionObj(parsed)
    if (!obj) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_WEBHOOK_MISSING)
    }

    if (!verifyPaymobTransactionHmac(obj, receivedHmac, hmacSecret)) {
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID)
    }
  }

  parseWebhookPayload(body: unknown): ParsedPaymentWebhook | null {
    const obj = this.extractTransactionObj(body)
    if (!obj) return null

    const providerPaymentId = obj.id !== undefined && obj.id !== null ? String(obj.id) : null
    if (!providerPaymentId) return null

    const merchantReference = this.extractMerchantReference(obj)
    const success = obj.success === true || obj.success === 'true'
    const pending = obj.pending === true || obj.pending === 'true'

    let status: 'paid' | 'failed' | 'pending' = 'failed'
    if (pending) {
      status = 'pending'
    } else if (success) {
      status = 'paid'
    }

    return {
      providerPaymentId,
      merchantReference,
      status,
    }
  }

  extractProviderPaymentId(body: unknown): string | null {
    return this.parseWebhookPayload(body)?.providerPaymentId ?? null
  }

  async createPayment(data: CreatePaymentProviderInput): Promise<CreatePaymentProviderResult> {
    const amountCents = Math.round(data.amount * 100)
    const secretKey = this.secretKey
    const publicKey = this.publicKey
    const integrationId = this.integrationId

    if (!secretKey || !publicKey) {
      const providerId = `mock_pi_${randomUUID()}`
      this.logger.warn('PAYMOB_SECRET_KEY or PAYMOB_PUBLIC_KEY missing — mock checkout (dev only)')
      const mockBase =
        this.config.get<string>('PAYMOB_MOCK_CHECKOUT_BASE') ?? `${this.apiBase}/unifiedcheckout`
      return {
        providerId,
        url: `${mockBase}/?publicKey=mock&clientSecret=${encodeURIComponent(providerId)}&ref=${encodeURIComponent(data.clientReferenceId)}`,
      }
    }

    const billing = data.billingData ?? {
      firstName: 'Parent',
      lastName: 'User',
      email: 'parent@ithraa.local',
      phoneNumber: '+966500000000',
    }

    const paymentMethods = integrationId ? [integrationId] : undefined

    const payload: Record<string, unknown> = {
      amount: amountCents,
      currency: data.currency,
      special_reference: data.clientReferenceId,
      notification_url: this.notificationUrl,
      redirection_url: data.successUrl,
      billing_data: {
        first_name: billing.firstName,
        last_name: billing.lastName,
        email: billing.email,
        phone_number: billing.phoneNumber,
      },
      items: [
        {
          name: data.description ?? 'Ithraa payment',
          amount: amountCents,
          description: data.description ?? 'Ithraa payment',
          quantity: 1,
        },
      ],
    }

    if (paymentMethods?.length) {
      payload.payment_methods = paymentMethods
    }

    const res = await fetch(`${this.apiBase}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const json = (await res.json().catch(() => null)) as PaymobIntentionResponse | null

    if (!res.ok) {
      this.logger.error(`Paymob intention create failed: HTTP ${res.status} ${JSON.stringify(json)}`)
      throw ApiException.serviceUnavailable(ApiErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE)
    }

    const intentionId = json?.id !== undefined ? String(json.id) : ''
    const clientSecret = json?.client_secret ?? ''

    if (!intentionId || !clientSecret) {
      this.logger.error(`Paymob intention response missing id/secret: ${JSON.stringify(json)}`)
      throw ApiException.serviceUnavailable(ApiErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE)
    }

    const checkoutUrl = `${this.apiBase}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`

    return {
      providerId: intentionId,
      url: checkoutUrl,
    }
  }

  async verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult> {
    if (providerPaymentId.startsWith('mock_pi_')) {
      return { status: 'paid' }
    }

    const secretKey = this.secretKey
    if (!secretKey) {
      this.logger.warn('PAYMOB_SECRET_KEY missing during verify — assuming paid (mock behaviour)')
      return { status: 'paid' }
    }

    const res = await fetch(
      `${this.apiBase}/v1/intention/${encodeURIComponent(providerPaymentId)}/`,
      {
        headers: {
          Authorization: `Token ${secretKey}`,
        },
      },
    )

    if (res.status === 404) {
      return { status: 'pending' }
    }

    if (!res.ok) {
      this.logger.warn(`Paymob verify HTTP ${res.status} for ${providerPaymentId}`)
      return { status: 'failed' }
    }

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const status = typeof json?.status === 'string' ? json.status.toLowerCase() : ''

    if (status === 'paid' || status === 'successful' || status === 'success') {
      return { status: 'paid' }
    }
    if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      return { status: 'failed' }
    }

    return { status: 'pending' }
  }

  private extractTransactionObj(body: unknown): PaymobTransactionObj | null {
    if (!body || typeof body !== 'object') return null
    const root = body as Record<string, unknown>

    if (root.obj && typeof root.obj === 'object' && root.obj !== null) {
      return root.obj as PaymobTransactionObj
    }

    if (root.id !== undefined) {
      return root as PaymobTransactionObj
    }

    return null
  }

  private extractMerchantReference(obj: PaymobTransactionObj): string | null {
    const order = obj.order
    if (order && typeof order === 'object' && order !== null) {
      const orderRecord = order as Record<string, unknown>
      const merchantOrderId = orderRecord.merchant_order_id ?? orderRecord.merchant_orderId
      if (merchantOrderId !== undefined && merchantOrderId !== null) {
        return String(merchantOrderId)
      }
    }

    const specialReference = obj.special_reference ?? obj.specialReference
    if (specialReference !== undefined && specialReference !== null) {
      return String(specialReference)
    }

    return null
  }
}
