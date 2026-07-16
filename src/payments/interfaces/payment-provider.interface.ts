import type { PaymentProviderEnum } from '../enums/payment-provider.enum'

export type CreatePaymentProviderInput = {
  /** Amount in major units (e.g. SAR with 2 decimal places). */
  amount: number
  currency: 'SAR'
  /** Our payment row id — used as merchant reference with the provider. */
  clientReferenceId: string
  description?: string
  successUrl: string
  cancelUrl?: string
  metadata: Record<string, unknown>
  billingData?: {
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
  }
}

export type CreatePaymentProviderResult = {
  url: string
  providerId: string
}

export type PaymentVerificationResult = {
  status: 'paid' | 'failed' | 'pending'
}

export type PaymentWebhookContext = {
  signatureHeader?: string
  query?: Record<string, string>
}

export type ParsedPaymentWebhook = {
  providerPaymentId: string
  merchantReference: string | null
  status: 'paid' | 'failed' | 'pending'
}

/**
 * Pluggable payment provider (Paymob primary).
 */
export interface PaymentProvider {
  readonly providerCode: PaymentProviderEnum

  createPayment(data: CreatePaymentProviderInput): Promise<CreatePaymentProviderResult>

  verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult>

  verifyWebhookSignature(rawBody: Buffer, context: PaymentWebhookContext): void

  parseWebhookPayload(body: unknown): ParsedPaymentWebhook | null

  /** @deprecated Use parseWebhookPayload — kept for backward compatibility in tests. */
  extractProviderPaymentId(body: unknown): string | null
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')
