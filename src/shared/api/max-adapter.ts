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

const isMaxChatId = (chatId: string) => chatId.length > 0

export function createMaxAdapter(input: ConnectionCredentials): MessengerAdapter {
  const { apiUrl, idInstance, apiTokenInstance, messenger } = normalizeCredentials(input)
  if (messenger !== 'max') throw new AppError('invalid-credentials')

  const chats = new Map<string, Chat>()
  const messages = new Map<string, Message[]>()
  const { get, post, receive, acknowledge } = createGreenApiTransport({ apiUrl, idInstance, apiTokenInstance, messenger })

  return {
    messenger: 'max',
    checkConnection: signal => checkRealConnection(input, signal),
    getChats: signal => loadGreenApiChats(get, chats, 'max', signal),
    getMessages: (chatId, signal) => loadGreenApiMessages(post, messages, chatId, signal),
    async resolveRecipient(phone, signal) {
      if (!/^(\+7\d{10}|\+375\d{9})$/.test(phone)) throw new AppError('invalid-max-phone')
      signal.throwIfAborted()

      const existing = [...chats.values()].find(chat => chat.phone === phone)
      if (existing) return { ...existing }

      const result = await post('checkAccount', { phoneNumber: Number(phone.slice(1)) }, signal)
      const chatId = parseCheckAccountRecipient(
        result, isMaxChatId, 'recipient-check-failed', 'recipient-unavailable',
      )
      signal.throwIfAborted()

      const chat = chats.get(chatId) ?? { id: chatId, title: phone, phone }
      chats.set(chat.id, chat)

      return { ...chat }
    },
    async sendText(chatId, text, signal) {
      assertCanSendText(chats, chatId, text, 4000, 'recipient-unavailable', 'invalid-max-message')

      return sendTextMessage(post, messages, chatId, text, signal)
    },
    readChat: (chatId, signal) => readGreenApiChat(post, chatId, signal),
    async receiveNotification(signal) {
      const received = await receiveGreenApiMessage(receive, messages, ignoredWebhookTypes, signal)
      if (received.kind === 'handled') return received.notification

      const { receiptId, body } = received

      const incoming = parsePersonalText(body, isMaxChatId)
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
