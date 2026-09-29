import { type PropsWithChildren, useMemo, useState } from 'react'

import { type Session, SessionContext } from './session-context'

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const value = useMemo(() => ({ session, setSession }), [session])

  return (
    <SessionContext value={value}>
      {children}
    </SessionContext>
  )
}
