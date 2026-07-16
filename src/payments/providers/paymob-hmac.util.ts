import { createHmac, timingSafeEqual } from 'crypto'

type PaymobTransactionObj = Record<string, unknown>

function nestedId(order: unknown): string {
  if (!order || typeof order !== 'object') return ''
  const id = (order as Record<string, unknown>).id
  return id !== undefined && id !== null ? String(id) : ''
}

function nestedPan(sourceData: unknown): string {
  if (!sourceData || typeof sourceData !== 'object') return ''
  const pan = (sourceData as Record<string, unknown>).pan
  return pan !== undefined && pan !== null ? String(pan) : ''
}

function nestedSubType(sourceData: unknown): string {
  if (!sourceData || typeof sourceData !== 'object') return ''
  const subType = (sourceData as Record<string, unknown>).sub_type
  return subType !== undefined && subType !== null ? String(subType) : ''
}

function nestedType(sourceData: unknown): string {
  if (!sourceData || typeof sourceData !== 'object') return ''
  const type = (sourceData as Record<string, unknown>).type
  return type !== undefined && type !== null ? String(type) : ''
}

function field(obj: PaymobTransactionObj, key: string): string {
  const value = obj[key]
  return value !== undefined && value !== null ? String(value) : ''
}

/**
 * Paymob transaction POST callback HMAC (SHA-512, 20-field concatenation).
 * @see https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac
 */
export function computePaymobTransactionHmac(
  obj: PaymobTransactionObj,
  hmacSecret: string,
): string {
  const concat = [
    field(obj, 'amount_cents'),
    field(obj, 'created_at'),
    field(obj, 'currency'),
    field(obj, 'error_occured'),
    field(obj, 'has_parent_transaction'),
    field(obj, 'id'),
    field(obj, 'integration_id'),
    field(obj, 'is_3d_secure'),
    field(obj, 'is_auth'),
    field(obj, 'is_capture'),
    field(obj, 'is_refunded'),
    field(obj, 'is_standalone_payment'),
    field(obj, 'is_voided'),
    nestedId(obj.order),
    field(obj, 'owner'),
    field(obj, 'pending'),
    nestedPan(obj.source_data),
    nestedSubType(obj.source_data),
    nestedType(obj.source_data),
    field(obj, 'success'),
  ].join('')

  return createHmac('sha512', hmacSecret).update(concat).digest('hex')
}

export function verifyPaymobTransactionHmac(
  obj: PaymobTransactionObj,
  receivedHmac: string,
  hmacSecret: string,
): boolean {
  if (!receivedHmac?.trim() || !hmacSecret?.trim()) {
    return false
  }

  const computed = computePaymobTransactionHmac(obj, hmacSecret)
  const computedBuf = Buffer.from(computed, 'utf8')
  const receivedBuf = Buffer.from(receivedHmac.trim().toLowerCase(), 'utf8')

  if (computedBuf.length !== receivedBuf.length) {
    return false
  }

  return timingSafeEqual(computedBuf, receivedBuf)
}
