import type { Session } from '@/shared/session'

export const chatQueryKey = (session: Session) => ['session', session.id, session.messenger, 'chats'] as const
