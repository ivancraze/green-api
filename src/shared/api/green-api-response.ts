import { AppError } from '@/shared/errors'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function requireMessageId(value: unknown): string {
  if (!isRecord(value) || typeof value.idMessage !== 'string' || !value.idMessage) {
    throw new AppError('invalid-response')
  }
  return value.idMessage
}

export function parseNotificationEnvelope(value: unknown): { receiptId: string; body: Record<string, unknown> } {
  if (!isRecord(value) || !Number.isSafeInteger(value.receiptId) || Number(value.receiptId) < 0
    || !isRecord(value.body) || typeof value.body.typeWebhook !== 'string') {
    throw new AppError('invalid-response')
  }
  return { receiptId: String(value.receiptId), body: value.body }
}

export function assertAcknowledged(value: unknown): void {
  if (!isRecord(value) || value.result !== true) throw new AppError('invalid-response')
}
