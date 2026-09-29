import { AppError } from '@/shared/errors'

import { checkRealConnection, normalizeCredentials } from './green-api-connection'
import { assertAcknowledged, isRecord, parseNotificationEnvelope, requireMessageId } from './green-api-response'
import { createGreenApiTransport } from './green-api-transport'
import type { Chat, ConnectionCredentials, Message, MessengerAdapter, Notification } from './messenger'

const ignoredWebhookTypes = new Set([
  'outgoingMessageReceived', 'outgoingAPIMessageReceived', 'outgoingMessageStatus',
  'stateInstanceChanged', 'statusInstanceChanged', 'deviceInfo', 'incomingCall',
  'outgoingCall', 'incomingBlock', 'quotaExceeded',
])

function parseWhatsappRecipient(value: unknown): string {
  if (!isRecord(value) || typeof value.existsWhatsapp !== 'boolean') throw new AppError('invalid-response')
  if (!value.existsWhatsapp) throw new AppError('whatsapp-recipient-unavailable')
  if (typeof value.chatId !== 'string' || !/^\d+@(c\.us|lid)$/.test(value.chatId)) {
    throw new AppError('invalid-response')
  }
  return value.chatId
}

function parseWhatsappIncoming(body: Record<string, unknown>): {
  id: string; chatId: string; text: string; timestamp: number; sender: Record<string, unknown>
} | null {
  const { senderData, messageData } = body
  if (!isRecord(senderData) || typeof senderData.chatId !== 'string'
    || !isRecord(messageData) || typeof messageData.typeMessage !== 'string') {
    throw new AppError('invalid-response')
  }
  if (!/^\d+@(c\.us|lid)$/.test(senderData.chatId)
    || !['textMessage', 'extendedTextMessage'].includes(messageData.typeMessage)) return null
  const data = messageData.typeMessage === 'textMessage'
    ? messageData.textMessageData : messageData.extendedTextMessageData
  const text = isRecord(data)
    ? (messageData.typeMessage === 'textMessage' ? data.textMessage : data.text) : undefined
  if (typeof body.timestamp !== 'number' || !Number.isFinite(body.timestamp)
    || typeof text !== 'string') throw new AppError('invalid-response')
  return {
    id: requireMessageId(body), chatId: senderData.chatId, text,
    timestamp: body.timestamp * 1000, sender: senderData,
  }
}

export function createWhatsappAdapter(input: ConnectionCredentials): MessengerAdapter {
  const credentials = normalizeCredentials(input)
  if (credentials.messenger !== 'whatsapp') throw new AppError('invalid-credentials')
  const { post, receive, acknowledge } = createGreenApiTransport(credentials)
  const chats = new Map<string, Chat>()
  const messages = new Map<string, Message[]>()
  const incomingAliases = new Map<string, string>()

  return {
    messenger: 'whatsapp',
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
      if (!/^\+[1-9]\d{10,14}$/.test(phone)) throw new AppError('invalid-whatsapp-phone')
      signal.throwIfAborted()
      const existing = [...chats.values()].find(chat => chat.phone === phone)
      if (existing) return { ...existing }
      const result = await post('checkWhatsapp', { phoneNumber: Number(phone.slice(1)) }, signal)
      const chatId = parseWhatsappRecipient(result)
      signal.throwIfAborted()
      const chat = chats.get(chatId) ?? { id: chatId, title: phone, phone }
      chats.set(chat.id, chat)
      return { ...chat }
    },
    async sendText(chatId, text, signal) {
      if (!chats.has(chatId)) throw new AppError('whatsapp-recipient-unavailable')
      if (!text.trim() || text.length > 20000) throw new AppError('invalid-whatsapp-message')
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
      const incoming = parseWhatsappIncoming(body)
      if (!incoming) return { receiptId, message: null }
      const incomingChatId = incoming.chatId
      let phone = incomingChatId.endsWith('@c.us') ? `+${incomingChatId.split('@')[0]}` : ''
      if (!phone && typeof incoming.sender.sender === 'string' && /^\d+@c\.us$/.test(incoming.sender.sender)) {
        phone = `+${incoming.sender.sender.split('@')[0]}`
      }
      if (!chats.has(incomingChatId) && !incomingAliases.has(incomingChatId) && !phone) {
        try {
          const checked = await post('checkWhatsapp', { chatId: incomingChatId }, signal)
          if (isRecord(checked) && checked.existsWhatsapp === true && typeof checked.phoneNumber === 'string') {
            const match = /^\[?(\d{11,15})@c\.us\]?$/.exec(checked.phoneNumber)
            if (match) phone = `+${match[1]}`
          }
        }
        catch {
          signal.throwIfAborted()
        }
      }
      const existing = phone ? [...chats.values()].find(chat => chat.phone === phone) : undefined
      if (existing && existing.id !== incomingChatId) incomingAliases.set(incomingChatId, existing.id)
      const chatId = incomingAliases.get(incomingChatId) ?? incomingChatId
      const title = [incoming.sender.senderContactName, incoming.sender.senderName, incoming.sender.chatName]
        .find(value => typeof value === 'string' && value.trim()) as string | undefined
      const chat = chats.get(chatId) ?? { id: chatId, title: title || phone || chatId, phone }
      const message: Message = {
        id: incoming.id, chatId, direction: 'incoming', author: chat.title,
        text: incoming.text, timestamp: incoming.timestamp,
      }
      signal.throwIfAborted()
      chats.set(chatId, chat)
      const history = messages.get(chatId) ?? []
      if (!history.some(existing => existing.id === message.id)) messages.set(chatId, [...history, message])
      return { receiptId, chat: { ...chat }, message: { ...message } } satisfies Notification
    },
    async acknowledgeNotification(receiptId, signal) {
      if (!/^\d+$/.test(receiptId)) throw new AppError('invalid-response')
      const result = await acknowledge(receiptId, signal)
      assertAcknowledged(result)
    },
  }
}
