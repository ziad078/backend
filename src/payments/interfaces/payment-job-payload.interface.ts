export type ProcessPaymentWebhookJobPayload = {
  providerPaymentId: string
  merchantReference?: string | null
  webhookStatus?: 'paid' | 'failed' | 'pending'
  rawBody: string
}

export type HandlePaymentSuccessJobPayload = {
  paymentId: string
}

export type HandlePaymentFailureJobPayload = {
  paymentId: string
  reason?: string
}
