import { AppError, type AppErrorCode } from '@/shared/errors'

import { assertChatRead, parseNotificationEnvelope, requireMessageId } from './green-api-response'
import type { createGreenApiTransport } from './green-api-transport'
import type { Chat, Message, Notification } from './messenger'

export function assertCanSendText(
  chats: Map<string, Chat>,
  chatId: string,
  text: string,
  maxLength: number,
  unavailableCode: AppErrorCode,
  invalidTextCode: AppErrorCode,
): void {
  if (!chats.has(chatId)) throw new AppError(unavailableCode)
  if (!text.trim() || text.length > maxLength) throw new AppError(invalidTextCode)
}

export function addUniqueMessage(messages: Map<string, Message[]>, message: Message): void {
  const history = messages.get(message.chatId) ?? []
  if (!history.some(existing => existing.id === message.id)) {
    messages.set(message.chatId, [...history, message])
  }
}

export function applyOutgoingStatus(messages: Map<string, Message[]>, body: Record<string, unknown>): Message | null {
  const { idMessage, chatId, status } = body
  if (typeof status !== 'string' || typeof chatId !== 'string' || !chatId) throw new AppError('invalid-response')
  if (typeof idMessage !== 'string' || !idMessage) {
    if (status === 'failed' || status === 'noAccount') return null
    throw new AppError('invalid-response')
  }
  const nextStatus = status === 'noAccount' || status === 'suspended' || status === 'yellowCard'
    ? 'failed' : status
  if (!['sent', 'delivered', 'read', 'failed'].includes(nextStatus)) throw new AppError('invalid-response')

  for (const [storedChatId, history] of messages) {
    const index = history.findIndex(message => message.id === idMessage && message.direction === 'outgoing')
    if (index < 0) continue
    const previous = history[index]
    if (previous.status === 'read' || previous.status === 'delivered' && nextStatus === 'sent') return { ...previous }
    const updated: Message = { ...previous, status: nextStatus as Message['status'] }
    messages.set(storedChatId, history.map((message, position) => position === index ? updated : message))
    return { ...updated }
  }
  return null
}

export async function receiveGreenApiMessage(
  receive: ReturnType<typeof createGreenApiTransport>['receive'],
  messages: Map<string, Message[]>,
  ignoredTypes: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<
  | { kind: 'handled'; notification: Notification | null }
  | { kind: 'incoming'; receiptId: string; body: Record<string, unknown> }
> {
  const result = await receive(signal)
  if (result === null) return { kind: 'handled', notification: null }

  const { receiptId, body } = parseNotificationEnvelope(result)
  if (body.typeWebhook === 'outgoingMessageStatus') {
    signal.throwIfAborted()

    return { kind: 'handled', notification: { receiptId, message: applyOutgoingStatus(messages, body) } }
  }
  if (ignoredTypes.has(String(body.typeWebhook))) {
    return { kind: 'handled', notification: { receiptId, message: null } }
  }
  if (body.typeWebhook !== 'incomingMessageReceived') throw new AppError('invalid-response')

  return { kind: 'incoming', receiptId, body }
}

export async function readGreenApiChat(
  post: ReturnType<typeof createGreenApiTransport>['post'],
  chatId: string,
  signal: AbortSignal,
): Promise<void> {
  if (!chatId) throw new AppError('invalid-response')
  const result = await post('readChat', { chatId }, signal)
  assertChatRead(result)
}

export async function sendTextMessage(
  post: ReturnType<typeof createGreenApiTransport>['post'],
  messages: Map<string, Message[]>,
  chatId: string,
  text: string,
  signal: AbortSignal,
): Promise<Message> {
  const result = await post('sendMessage', { chatId, message: text }, signal)
  const id = requireMessageId(result)
  signal.throwIfAborted()

  const message: Message = {
    id,
    chatId,
    direction: 'outgoing',
    author: 'Вы',
    text,
    timestamp: Date.now(),
  }
  addUniqueMessage(messages, message)

  return { ...message }
}

export function storeIncomingMessage(
  chats: Map<string, Chat>,
  messages: Map<string, Message[]>,
  chat: Chat,
  incoming: Pick<Message, 'id' | 'text' | 'timestamp'>,
  author: string,
  receiptId: string,
  signal: AbortSignal,
): Notification {
  const message: Message = {
    id: incoming.id,
    chatId: chat.id,
    direction: 'incoming',
    author,
    text: incoming.text,
    timestamp: incoming.timestamp,
  }
  signal.throwIfAborted()
  chats.set(chat.id, chat)
  addUniqueMessage(messages, message)

  return { receiptId, chat: { ...chat }, message: { ...message } }
}
