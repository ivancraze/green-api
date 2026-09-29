import { AppError } from '@/shared/errors'

import { createDemoData, demoStartTime } from './demo-data'
import type { Message, Messenger, MessengerAdapter, Notification } from './messenger'

export const demoDelays = { operation: 200, reply: 800 } as const

export interface DemoFailures {
  connection?: boolean
  send?: boolean
  receive?: boolean
  acknowledge?: boolean
}

export interface DemoAdapter extends MessengerAdapter {
  // Заменяет сценарий целиком; {} восстанавливает нормальную работу.
  setFailures(failures: DemoFailures): void
}

function wait(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AppError('cancelled'))
      return
    }
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new AppError('cancelled'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, demoDelays.operation)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export function createDemoAdapter(messenger: Messenger): DemoAdapter {
  const { chats, messages } = createDemoData(messenger)
  const queue: { notification: Notification & { message: Message }, readyAt: number }[] = []
  let failures: DemoFailures = {}
  let messageSequence = messages.length
  let receiptSequence = 0

  function findChat(chatId: string) {
    const chat = chats.find(chat => chat.id === chatId)
    if (!chat) throw new AppError('unknown')
    return chat
  }

  async function operation(signal: AbortSignal, failure?: keyof DemoFailures) {
    await wait(signal)
    // Отмена после истечения таймера также не должна менять данные.
    if (signal.aborted) throw new AppError('cancelled')
    if (failure && failures[failure]) {
      throw new AppError(failure === 'connection' ? 'unauthorized' : 'network')
    }
  }

  return {
    messenger,
    setFailures(next) {
      failures = { ...next }
    },
    async checkConnection(signal) {
      await operation(signal, 'connection')
    },
    async getChats(signal) {
      await operation(signal)
      return chats.map(chat => ({ ...chat }))
    },
    async getMessages(chatId, signal) {
      await operation(signal)
      findChat(chatId)
      return messages.filter(message => message.chatId === chatId).map(message => ({ ...message }))
    },
    async resolveRecipient(phone, signal) {
      await operation(signal)
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AppError('unknown')
      const existing = chats.find(chat => chat.phone === phone)
      if (existing) return { ...existing }
      const chat = { id: `demo-${messenger}-${chats.length + 1}`, title: phone, phone }
      chats.push(chat)
      return { ...chat }
    },
    async sendText(chatId, text, signal) {
      await operation(signal, 'send')
      const chat = findChat(chatId)
      if (!text.trim()) throw new AppError('unknown')
      const outgoing = {
        id: `demo-${messenger}-message-${++messageSequence}`,
        chatId,
        direction: 'outgoing' as const,
        author: 'Вы',
        text,
        timestamp: demoStartTime + (messageSequence - 1) * 1000,
      }
      messages.push(outgoing)
      const incoming = {
        id: `demo-${messenger}-message-${++messageSequence}`,
        chatId,
        direction: 'incoming' as const,
        author: chat.title,
        text: `Тестовый ответ: ${text}`,
        timestamp: demoStartTime + (messageSequence - 1) * 1000,
      }
      queue.push({
        notification: { receiptId: `demo-${messenger}-receipt-${++receiptSequence}`, message: incoming },
        readyAt: Date.now() + demoDelays.reply,
      })
      return { ...outgoing }
    },
    async receiveNotification(signal) {
      await operation(signal, 'receive')
      const pending = queue[0]
      if (!pending || pending.readyAt > Date.now()) return null
      const { receiptId, message } = pending.notification
      if (!messages.some(existing => existing.id === message.id)) messages.push(message)
      return { receiptId, message: { ...message } }
    },
    async acknowledgeNotification(receiptId, signal) {
      await operation(signal, 'acknowledge')
      const index = queue.findIndex(item => item.notification.receiptId === receiptId)
      if (index === -1) throw new AppError('unknown')
      queue.splice(index, 1)
    },
  }
}
