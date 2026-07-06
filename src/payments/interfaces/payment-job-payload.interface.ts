export type ProcessPaymentWebhookJobPayload = {
  providerPaymentId: string
  /** Raw JSON string (re-parsed in worker). */
  rawBody: string
}

export type HandlePaymentSuccessJobPayload = {
  paymentId: string
}

export type HandlePaymentFailureJobPayload = {
  paymentId: string
  reason?: string
}
