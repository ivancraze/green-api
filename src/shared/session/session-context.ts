import { createContext, use } from 'react'

import type { DemoAdapter, Messenger, MessengerAdapter } from '@/shared/api'

export interface Session {
  id: string
  messenger: Messenger
  adapter: MessengerAdapter
  demo?: Pick<DemoAdapter, 'setFailures'>
}

interface SessionContextValue {
  session: Session | null
  setSession: (session: Session | null) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = use(SessionContext)

  if (context === null) {
    throw new Error('useSession must be used within SessionProvider')
  }

  return context
}
