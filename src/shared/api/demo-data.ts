import type { Chat, Message, Messenger } from './messenger'

export const demoStartTime = Date.UTC(2026, 0, 1, 12)

const messengerTitles: Record<Messenger, string> = {
  max: 'MAX',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

export function createDemoData(messenger: Messenger) {
  const chats: Chat[] = [
    { id: `demo-${messenger}-1`, title: `Анна · ${messengerTitles[messenger]}`, phone: '+12025550101' },
    { id: `demo-${messenger}-2`, title: `Борис · ${messengerTitles[messenger]}`, phone: '+12025550102' },
  ]
  const messages: Message[] = [
    {
      id: `demo-${messenger}-message-1`,
      chatId: chats[0].id,
      direction: 'incoming',
      author: chats[0].title,
      text: `Привет! Это тестовый чат ${messengerTitles[messenger]}.`,
      timestamp: demoStartTime,
    },
    {
      id: `demo-${messenger}-message-2`,
      chatId: chats[0].id,
      direction: 'outgoing',
      author: 'Вы',
      text: 'Привет! Проверяю отправку текста.',
      timestamp: demoStartTime + 1000,
    },
    {
      id: `demo-${messenger}-message-3`,
      chatId: chats[0].id,
      direction: 'incoming',
      author: chats[0].title,
      text: '<b>Это обычный текст, а не HTML.</b>',
      timestamp: demoStartTime + 2000,
    },
  ]
  return { chats, messages }
}
