import { AppError } from '@/shared/errors'

import { checkRealConnection, normalizeCredentials } from './green-api-connection'
import { loadGreenApiChats, loadGreenApiMessages } from './green-api-history'
import {
  assertCanSendText,
  readGreenApiChat,
  receiveGreenApiMessage,
  sendTextMessage,
  storeIncomingMessage
} from './green-api-message'
import {
  assertAcknowledged,
  assertReceiptId,
  isRecord,
  requireMessageId
} from './green-api-response'
import { createGreenApiTransport } from './green-api-transport'
import type {
  Chat,
  ConnectionCredentials,
  Message,
  MessengerAdapter
} from './messenger'

const ignoredWebhookTypes = new Set([
  'outgoingMessageReceived', 'outgoingAPIMessageReceived',
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

  const { get, post, receive, acknowledge } = createGreenApiTransport(credentials)
  const chats = new Map<string, Chat>()
  const messages = new Map<string, Message[]>()
  const incomingAliases = new Map<string, string>()

  return {
    messenger: 'whatsapp',
    checkConnection: signal => checkRealConnection(credentials, signal),
    getChats: signal => loadGreenApiChats(get, chats, 'whatsapp', signal),
    getMessages: (chatId, signal) => loadGreenApiMessages(post, messages, chatId, signal),
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
      assertCanSendText(chats, chatId, text, 20000, 'whatsapp-recipient-unavailable', 'invalid-whatsapp-message')

      return sendTextMessage(post, messages, chatId, text, signal)
    },
    readChat: (chatId, signal) => readGreenApiChat(post, chatId, signal),
    async receiveNotification(signal) {
      const received = await receiveGreenApiMessage(receive, messages, ignoredWebhookTypes, signal)
      if (received.kind === 'handled') return received.notification

      const { receiptId, body } = received

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

      return storeIncomingMessage(chats, messages, chat, incoming, chat.title, receiptId, signal)
    },
    async acknowledgeNotification(receiptId, signal) {
      assertReceiptId(receiptId)
      const result = await acknowledge(receiptId, signal)
      assertAcknowledged(result)
    },
  }
}
