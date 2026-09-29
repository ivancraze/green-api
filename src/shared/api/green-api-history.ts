import { AppError } from '@/shared/errors'

import { isRecord } from './green-api-response'
import type { createGreenApiTransport } from './green-api-transport'
import type { Chat, Message, Messenger } from './messenger'

function personalChatId(id: string, messenger: Messenger): boolean {
  if (messenger === 'whatsapp') return /^\d+@(c\.us|lid)$/.test(id)
  if (messenger === 'telegram') return /^\d+$/.test(id)
  return id.length > 0
}

function phoneFrom(value: unknown): string {
  return (typeof value === 'number' || typeof value === 'string') && /^[1-9]\d{7,14}$/.test(String(value))
    ? `+${value}` : ''
}

export async function loadGreenApiChats(
  get: ReturnType<typeof createGreenApiTransport>['get'],
  chats: Map<string, Chat>,
  messenger: Messenger,
  signal: AbortSignal,
): Promise<Chat[]> {
  const result = await get('getChats', signal)
  if (!Array.isArray(result)) throw new AppError('invalid-response')
  const loaded: Chat[] = []
  for (const item of result) {
    if (!isRecord(item)) throw new AppError('invalid-response')
    if (item.type !== 'user') continue
    const id = messenger === 'whatsapp' ? item.id : item.chatId
    if (typeof id !== 'string' || !personalChatId(id, messenger)) throw new AppError('invalid-response')
    const phone = messenger === 'whatsapp' && id.endsWith('@c.us')
      ? phoneFrom(id.slice(0, -5)) : phoneFrom(item.phoneNumber)
    const previous = chats.get(id)
    loaded.push({
      id,
      title: typeof item.name === 'string' && item.name.trim() ? item.name : previous?.title || phone || id,
      phone: phone || previous?.phone || '',
    })
  }
  if (loaded.length === 0 && chats.size === 0) {
    const [incoming, outgoing] = await Promise.all([
      get('lastIncomingMessages', signal, 20160),
      get('lastOutgoingMessages', signal, 20160),
    ])
    if (!Array.isArray(incoming) || !Array.isArray(outgoing)) throw new AppError('invalid-response')
    const journal = [...incoming, ...outgoing]
      .filter(isRecord)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    const byId = new Map<string, Chat>()
    const named = new Set<string>()
    for (const item of journal) {
      const id = item.chatId
      if (typeof id !== 'string' || !personalChatId(id, messenger)
        || item.chatType !== undefined && item.chatType !== 'user') continue
      const phone = messenger === 'whatsapp' && id.endsWith('@c.us')
        ? phoneFrom(id.slice(0, -5)) : phoneFrom(item.senderPhoneNumber)
      const name = [item.senderContactName, item.senderName]
        .find(value => typeof value === 'string' && value.trim())
      const existing = byId.get(id)
      if (existing) {
        if (typeof name === 'string' && !named.has(id)) {
          existing.title = name
          named.add(id)
        }
        if (!existing.phone && phone) existing.phone = phone
        continue
      }
      const chat = { id, title: typeof name === 'string' ? name : phone || id, phone }
      byId.set(id, chat)
      if (typeof name === 'string') named.add(id)
      loaded.push(chat)
    }
  }
  signal.throwIfAborted()
  for (const chat of loaded) chats.set(chat.id, chat)
  return [...chats.values()].map(chat => ({ ...chat }))
}

export async function loadGreenApiMessages(
  post: ReturnType<typeof createGreenApiTransport>['post'],
  messages: Map<string, Message[]>,
  chatId: string,
  signal: AbortSignal,
): Promise<Message[]> {
  const result = await post('getChatHistory', { chatId, count: 100 }, signal)
  if (!Array.isArray(result)) throw new AppError('invalid-response')
  const loaded: Message[] = []
  for (const item of result) {
    if (!isRecord(item)) throw new AppError('invalid-response')
    if (item.typeMessage !== 'textMessage' && item.typeMessage !== 'extendedTextMessage') continue
    if (item.isDeleted === true) continue
    if (item.chatId !== chatId || typeof item.idMessage !== 'string' || !item.idMessage
      || (item.type !== 'incoming' && item.type !== 'outgoing')
      || typeof item.timestamp !== 'number' || !Number.isFinite(item.timestamp)
      || typeof item.textMessage !== 'string') throw new AppError('invalid-response')
    const direction = item.type
    const status = item.statusMessage
    loaded.push({
      id: item.idMessage, chatId, direction,
      author: direction === 'outgoing' ? 'Вы'
        : typeof item.senderContactName === 'string' && item.senderContactName.trim() ? item.senderContactName
          : typeof item.senderName === 'string' && item.senderName.trim() ? item.senderName : 'Собеседник',
      text: item.textMessage,
      timestamp: item.timestamp * 1000,
      ...(direction === 'outgoing' && ['sent', 'delivered', 'read', 'failed'].includes(String(status))
        ? { status: status as Message['status'] } : {}),
    })
  }
  signal.throwIfAborted()
  const merged = new Map(loaded.map(message => [message.id, message]))
  for (const message of messages.get(chatId) ?? []) {
    const status = message.status ?? merged.get(message.id)?.status
    merged.set(message.id, status ? { ...message, status } : message)
  }
  const history = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
  messages.set(chatId, history)
  return history.map(message => ({ ...message }))
}
