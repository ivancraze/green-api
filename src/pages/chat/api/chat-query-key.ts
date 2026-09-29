import type { ChatSession } from '@/shared/session'

export const chatQueryKey = (session: ChatSession) => ['session', session.id, session.messenger, 'chats'] as const
export const messageQueryKey = (session: ChatSession, chatId: string) => ['session', session.id, session.messenger, 'messages', chatId] as const
