import type { Session } from '@/shared/session'

export const chatQueryKey = (session: Session) => ['session', session.id, session.messenger, 'chats'] as const
export const messageQueryKey = (session: Session, chatId: string) => ['session', session.id, session.messenger, 'messages', chatId] as const
