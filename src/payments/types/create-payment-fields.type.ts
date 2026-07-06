import type { PaymentProviderEnum } from '../enums/payment-provider.enum'

/** Plain shape for payment creation (kept separate from class-validator DTOs for reliable ESLint typing). */
export type CreatePaymentFields = {
  amount: number
  currency?: string
  privateChildId: string
  attemptRequestId?: string
  privateAttemptId?: string
  description?: string
  provider?: PaymentProviderEnum
}
