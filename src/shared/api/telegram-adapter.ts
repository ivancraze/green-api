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
  parseCheckAccountRecipient,
  parsePersonalText,
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
  'stateInstanceChanged', 'quotaExceeded',
])

const isTelegramChatId = (chatId: string) => /^\d+$/.test(chatId)

export function createTelegramAdapter(input: ConnectionCredentials): MessengerAdapter {
  const credentials = normalizeCredentials(input)
  if (credentials.messenger !== 'telegram') throw new AppError('invalid-credentials')
  const { get, post, receive, acknowledge } = createGreenApiTransport(credentials)
  const chats = new Map<string, Chat>()
  const messages = new Map<string, Message[]>()

  return {
    messenger: 'telegram',
    checkConnection: signal => checkRealConnection(credentials, signal),
    getChats: signal => loadGreenApiChats(get, chats, 'telegram', signal),
    getMessages: (chatId, signal) => loadGreenApiMessages(post, messages, chatId, signal),
    async resolveRecipient(phone, signal) {
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AppError('invalid-telegram-phone')
      signal.throwIfAborted()
      const existing = [...chats.values()].find(chat => chat.phone === phone)
      if (existing) return { ...existing }
      const result = await post('checkAccount', { phoneNumber: Number(phone.slice(1)) }, signal)
      const chatId = parseCheckAccountRecipient(
        result, isTelegramChatId, 'telegram-recipient-check-failed', 'telegram-recipient-unavailable',
      )
      signal.throwIfAborted()
      const chat = chats.get(chatId) ?? { id: chatId, title: phone, phone }
      chats.set(chat.id, chat)

      return { ...chat }
    },
    async sendText(chatId, text, signal) {
      assertCanSendText(chats, chatId, text, 4096, 'telegram-recipient-unavailable', 'invalid-telegram-message')

      return sendTextMessage(post, messages, chatId, text, signal)
    },
    readChat: (chatId, signal) => readGreenApiChat(post, chatId, signal),
    async receiveNotification(signal) {
      const received = await receiveGreenApiMessage(receive, messages, ignoredWebhookTypes, signal)
      if (received.kind === 'handled') return received.notification

      const { receiptId, body } = received

      const incoming = parsePersonalText(body, isTelegramChatId)
      if (!incoming) return { receiptId, message: null }

      const chat = chats.get(incoming.chatId) ?? {
        id: incoming.chatId, title: incoming.title, phone: incoming.phone,
      }

      return storeIncomingMessage(chats, messages, chat, incoming, incoming.title, receiptId, signal)
    },
    async acknowledgeNotification(receiptId, signal) {
      assertReceiptId(receiptId)
      const result = await acknowledge(receiptId, signal)
      assertAcknowledged(result)
    },
  }
}
