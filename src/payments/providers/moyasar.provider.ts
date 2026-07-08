import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import type {
  CreatePaymentProviderInput,
  CreatePaymentProviderResult,
  PaymentProvider,
  PaymentVerificationResult,
} from '../interfaces/payment-provider.interface'
import { PaymentProviderEnum } from '../enums/payment-provider.enum'

@Injectable()
export class MoyasarProvider implements PaymentProvider {
  readonly providerCode = PaymentProviderEnum.MOYASAR
  private readonly logger = new Logger(MoyasarProvider.name)

  constructor(private readonly config: ConfigService) {}

  private get apiBase(): string {
    return (
      this.config.get<string>('MOYASAR_API_BASE')?.replace(/\/$/, '') ?? 'https://api.moyasar.com'
    )
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): void {
    const secret = this.config.get<string>('MOYASAR_WEBHOOK_SECRET')
    if (!secret?.trim()) {
      this.logger.error('MOYASAR_WEBHOOK_SECRET is not configured')
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID, 'Webhook verification is not configured')
    }

    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex')
    const provided = (signatureHeader ?? '').trim()

    if (!provided) {
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID, 'Missing webhook signature')
    }

    const normalized = provided.toLowerCase()
    const expectedBuf = Buffer.from(expectedHex, 'utf8')
    const providedBuf = Buffer.from(normalized, 'utf8')

    if (expectedBuf.length !== providedBuf.length) {
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID, 'Invalid webhook signature')
    }

    if (!timingSafeEqual(expectedBuf, providedBuf)) {
      throw ApiException.unauthorized(ApiErrorCodes.PAYMENT_WEBHOOK_INVALID, 'Invalid webhook signature')
    }
  }

  /**
   * Extract Moyasar payment id from webhook JSON body.
   */
  extractProviderPaymentId(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null
    const root = body as Record<string, unknown>
    if (root.data && typeof root.data === 'object' && root.data !== null) {
      const id = (root.data as Record<string, unknown>).id
      if (id !== undefined && id !== null) return String(id)
    }
    if (root.id !== undefined && root.id !== null) return String(root.id)
    return null
  }

  async createPayment(data: CreatePaymentProviderInput): Promise<CreatePaymentProviderResult> {
    const secret = this.config.get<string>('MOYASAR_SECRET_KEY')
    const amountMinor = Math.round(data.amount * 100)

    if (!secret?.trim()) {
      const providerId = `mock_pay_${randomUUID()}`
      this.logger.warn('MOYASAR_SECRET_KEY is not set — using mock checkout (development only)')
      const base =
        this.config.get<string>('MOYASAR_MOCK_CHECKOUT_BASE') ??
        'https://dashboard.moyasar.com/sandbox'
      return {
        providerId,
        url: `${base}/mock-checkout?payment_id=${encodeURIComponent(providerId)}&amount=${amountMinor}&ref=${encodeURIComponent(data.clientReferenceId)}`,
      }
    }

    const auth = Buffer.from(`${secret}:`).toString('base64')
    const callbackUrl = data.successUrl

    const res = await fetch(`${this.apiBase}/v1/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: data.currency,
        description: data.description ?? `Payment ${data.clientReferenceId.slice(0, 8)}`,
        callback_url: callbackUrl,
        metadata: {
          ...data.metadata,
          client_reference: data.clientReferenceId,
        },
      }),
    })

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (!res.ok) {
      this.logger.error(`Moyasar invoice create failed: HTTP ${res.status} ${JSON.stringify(json)}`)
      throw ApiException.serviceUnavailable(ApiErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE, 'Payment service unavailable')
    }

    const providerId = String(json?.id ?? '')
    const url =
      (typeof json?.url === 'string' && json.url) ||
      (typeof json?.invoice_url === 'string' && json.invoice_url) ||
      ''

    if (!providerId || !url) {
      this.logger.error(`Moyasar invoice response missing id/url: ${JSON.stringify(json)}`)
      throw ApiException.serviceUnavailable(ApiErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE, 'Payment service unavailable')
    }

    return { providerId, url }
  }

  async verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult> {
    if (providerPaymentId.startsWith('mock_pay_')) {
      return { status: 'paid' }
    }

    const secret = this.config.get<string>('MOYASAR_SECRET_KEY')
    if (!secret?.trim()) {
      this.logger.warn('MOYASAR_SECRET_KEY missing during verify — assuming paid (mock behaviour)')
      return { status: 'paid' }
    }

    const auth = Buffer.from(`${secret}:`).toString('base64')
    const mapInvoiceStatus = (st: string | undefined): 'paid' | 'failed' | 'pending' => {
      if (st === 'paid') return 'paid'
      if (st === 'failed' || st === 'voided' || st === 'expired' || st === 'abandoned') {
        return 'failed'
      }
      return 'pending'
    }

    const invoiceRes = await fetch(
      `${this.apiBase}/v1/invoices/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )

    if (invoiceRes.ok) {
      const json = (await invoiceRes.json().catch(() => null)) as {
        status?: string
      } | null
      return { status: mapInvoiceStatus(json?.status) }
    }

    const payRes = await fetch(
      `${this.apiBase}/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )

    if (payRes.status === 404) {
      return { status: 'pending' }
    }

    if (!payRes.ok) {
      this.logger.warn(`Moyasar verify HTTP ${payRes.status} for ${providerPaymentId}`)
      return { status: 'failed' }
    }

    const json = (await payRes.json().catch(() => null)) as {
      status?: string
    } | null
    const st = json?.status

    if (st === 'paid' || st === 'captured' || st === 'authorized') {
      return { status: 'paid' }
    }
    if (st === 'failed' || st === 'voided' || st === 'refunded' || st === 'abandoned') {
      return { status: 'failed' }
    }
    return { status: 'pending' }
  }
}
