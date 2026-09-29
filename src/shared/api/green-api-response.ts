import { AppError, type AppErrorCode } from '@/shared/errors'

interface PersonalText {
  id: string
  chatId: string
  phone: string
  title: string
  text: string
  timestamp: number
}

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

export function assertChatRead(value: unknown): void {
  if (!isRecord(value) || value.setRead !== true) throw new AppError('invalid-response')
}

export function assertReceiptId(receiptId: string): void {
  if (!/^\d+$/.test(receiptId)) throw new AppError('invalid-response')
}

export function parseCheckAccountRecipient(
  value: unknown,
  isValidChatId: (chatId: string) => boolean,
  checkFailed: AppErrorCode,
  unavailable: AppErrorCode,
): string {
  if (!isRecord(value)) throw new AppError('invalid-response')
  if (value.status === false) throw new AppError(checkFailed)
  if (typeof value.exist !== 'boolean') throw new AppError('invalid-response')
  if (!value.exist) throw new AppError(unavailable)
  if (typeof value.chatId !== 'string' || !isValidChatId(value.chatId)) {
    throw new AppError('invalid-response')
  }

  return value.chatId
}

export function parsePersonalText(
  body: Record<string, unknown>,
  isValidChatId: (chatId: string) => boolean,
): PersonalText | null {
  const { senderData, messageData } = body
  if (!isRecord(senderData) || typeof senderData.chatType !== 'string'
    || !isRecord(messageData) || typeof messageData.typeMessage !== 'string') {
    throw new AppError('invalid-response')
  }

  if (senderData.chatType !== 'user' || messageData.typeMessage !== 'textMessage') return null

  if (typeof senderData.chatId !== 'string' || !isValidChatId(senderData.chatId)
    || typeof body.timestamp !== 'number' || !Number.isFinite(body.timestamp)
    || !isRecord(messageData.textMessageData)
    || typeof messageData.textMessageData.textMessage !== 'string') {
    throw new AppError('invalid-response')
  }

  const phone = Number.isSafeInteger(senderData.senderPhoneNumber) && Number(senderData.senderPhoneNumber) > 0
    ? `+${senderData.senderPhoneNumber}` : ''
  const title = typeof senderData.senderName === 'string' && senderData.senderName.trim()
    ? senderData.senderName : phone || senderData.chatId

  return {
    id: requireMessageId(body),
    chatId: senderData.chatId,
    phone,
    title,
    text: messageData.textMessageData.textMessage,
    timestamp: body.timestamp * 1000,
  }
}
