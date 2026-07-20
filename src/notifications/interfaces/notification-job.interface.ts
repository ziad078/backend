import { NotificationDelivery } from '../enums/notification-delivery.enum'

export interface NotificationSendJobPayload {
  delivery: NotificationDelivery
  userId: string
  email?: string
  phone?: string
  title: string
  message: string
  type?: string
  metadata?: Record<string, unknown> | null
}
