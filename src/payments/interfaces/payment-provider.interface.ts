import type { PaymentProviderEnum } from '../enums/payment-provider.enum'

export type CreatePaymentProviderInput = {
  /** Amount in major units (e.g. SAR with 2 decimal places). */
  amount: number
  currency: 'SAR'
  /** Our payment row id — used for idempotency with the provider. */
  clientReferenceId: string
  description?: string
  successUrl: string
  cancelUrl?: string
  metadata: Record<string, unknown>
}

export type CreatePaymentProviderResult = {
  url: string
  providerId: string
}

export type PaymentVerificationResult = {
  status: 'paid' | 'failed' | 'pending'
}

/**
 * Pluggable payment provider (Moyasar today; PayTabs / HyperPay later).
 * Webhook verification is provider-specific and lives alongside the implementation.
 */
export interface PaymentProvider {
  readonly providerCode: PaymentProviderEnum

  createPayment(data: CreatePaymentProviderInput): Promise<CreatePaymentProviderResult>

  verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult>

  /**
   * Validate webhook authenticity (e.g. HMAC). Throws if invalid.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): void

  /** Parse provider reference id from a verified JSON webhook body. */
  extractProviderPaymentId(body: unknown): string | null
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')
