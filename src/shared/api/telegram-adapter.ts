import { AppError } from '@/shared/errors'

import { checkRealConnection, normalizeCredentials } from './green-api-connection'
import { assertAcknowledged, isRecord, parseNotificationEnvelope, requireMessageId } from './green-api-response'
import { createGreenApiTransport } from './green-api-transport'
import type { Chat, ConnectionCredentials, Message, MessengerAdapter, Notification } from './messenger'

const ignoredWebhookTypes = new Set([
  'outgoingMessageReceived', 'outgoingAPIMessageReceived', 'outgoingMessageStatus',
  'stateInstanceChanged', 'quotaExceeded',
])

function parseTelegramRecipient(value: unknown): string {
  if (!isRecord(value)) throw new AppError('invalid-response')
  if (value.status === false) throw new AppError('telegram-recipient-check-failed')
  if (typeof value.exist !== 'boolean') throw new AppError('invalid-response')
  if (!value.exist) throw new AppError('telegram-recipient-unavailable')
  if (typeof value.chatId !== 'string' || !/^\d+$/.test(value.chatId)) throw new AppError('invalid-response')
  return value.chatId
}

function parseTelegramIncoming(body: Record<string, unknown>): {
  id: string; chatId: string; phone: string; title: string; text: string; timestamp: number
} | null {
  const { senderData, messageData } = body
  if (!isRecord(senderData) || typeof senderData.chatType !== 'string'
    || !isRecord(messageData) || typeof messageData.typeMessage !== 'string') {
    throw new AppError('invalid-response')
  }
  if (senderData.chatType !== 'user' || messageData.typeMessage !== 'textMessage') return null
  if (typeof senderData.chatId !== 'string' || !/^\d+$/.test(senderData.chatId)
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
    id: requireMessageId(body), chatId: senderData.chatId, phone, title,
    text: messageData.textMessageData.textMessage, timestamp: body.timestamp * 1000,
  }
}

export function createTelegramAdapter(input: ConnectionCredentials): MessengerAdapter {
  const credentials = normalizeCredentials(input)
  if (credentials.messenger !== 'telegram') throw new AppError('invalid-credentials')
  const { post, receive, acknowledge } = createGreenApiTransport(credentials)
  const chats = new Map<string, Chat>()
  const messages = new Map<string, Message[]>()

  return {
    messenger: 'telegram',
    checkConnection: signal => checkRealConnection(credentials, signal),
    async getChats(signal) {
      signal.throwIfAborted()
      return [...chats.values()].map(chat => ({ ...chat }))
    },
    async getMessages(chatId, signal) {
      signal.throwIfAborted()
      return (messages.get(chatId) ?? []).map(message => ({ ...message }))
    },
    async resolveRecipient(phone, signal) {
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AppError('invalid-telegram-phone')
      signal.throwIfAborted()
      const existing = [...chats.values()].find(chat => chat.phone === phone)
      if (existing) return { ...existing }
      const result = await post('checkAccount', { phoneNumber: Number(phone.slice(1)) }, signal)
      const chatId = parseTelegramRecipient(result)
      signal.throwIfAborted()
      const chat = chats.get(chatId) ?? { id: chatId, title: phone, phone }
      chats.set(chat.id, chat)
      return { ...chat }
    },
    async sendText(chatId, text, signal) {
      if (!chats.has(chatId)) throw new AppError('telegram-recipient-unavailable')
      if (!text.trim() || text.length > 4096) throw new AppError('invalid-telegram-message')
      const result = await post('sendMessage', { chatId, message: text }, signal)
      const id = requireMessageId(result)
      signal.throwIfAborted()
      const message: Message = {
        id, chatId, direction: 'outgoing', author: 'Вы', text, timestamp: Date.now(),
      }
      const history = messages.get(chatId) ?? []
      if (!history.some(existing => existing.id === message.id)) messages.set(chatId, [...history, message])
      return { ...message }
    },
    async receiveNotification(signal) {
      const result = await receive(signal)
      if (result === null) return null
      const { receiptId, body } = parseNotificationEnvelope(result)
      if (ignoredWebhookTypes.has(String(body.typeWebhook))) return { receiptId, message: null }
      if (body.typeWebhook !== 'incomingMessageReceived') throw new AppError('invalid-response')
      const incoming = parseTelegramIncoming(body)
      if (!incoming) return { receiptId, message: null }
      const chat = chats.get(incoming.chatId) ?? {
        id: incoming.chatId, title: incoming.title, phone: incoming.phone,
      }
      const message: Message = {
        id: incoming.id, chatId: incoming.chatId, direction: 'incoming', author: incoming.title,
        text: incoming.text, timestamp: incoming.timestamp,
      }
      signal.throwIfAborted()
      chats.set(incoming.chatId, chat)
      const history = messages.get(incoming.chatId) ?? []
      if (!history.some(existing => existing.id === message.id)) messages.set(incoming.chatId, [...history, message])
      return { receiptId, chat: { ...chat }, message: { ...message } } satisfies Notification
    },
    async acknowledgeNotification(receiptId, signal) {
      if (!/^\d+$/.test(receiptId)) throw new AppError('invalid-response')
      const result = await acknowledge(receiptId, signal)
      assertAcknowledged(result)
    },
  }
}
