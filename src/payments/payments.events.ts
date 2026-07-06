import type { PaymentMetadata } from './entities/payment.entity'

export const PAYMENT_EVENTS = {
  SUCCESS: 'payment.success',
  FAILED: 'payment.failed',
} as const

export type PaymentSuccessEventPayload = {
  paymentId: string
  userId: string
  amount: string
  currency: string
  metadata: PaymentMetadata
}

export type PaymentFailedEventPayload = {
  paymentId: string
  userId: string
  amount: string
  currency: string
  metadata: PaymentMetadata
  reason?: string
}
