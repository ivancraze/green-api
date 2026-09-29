import { createContext, use } from 'react'

export interface Session {
  id: string
  messenger: 'max' | 'whatsapp' | 'telegram'
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
