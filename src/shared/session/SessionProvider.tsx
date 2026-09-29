import { useQueryClient } from '@tanstack/react-query'
import { type PropsWithChildren, useCallback, useMemo, useState } from 'react'

import { type Session, SessionContext } from './session-context'

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const setSession = useCallback((next: Session | null) => {
    void queryClient.cancelQueries()
    queryClient.clear()
    setCurrentSession(next)
  }, [queryClient])
  const value = useMemo(() => ({ session: currentSession, setSession }), [currentSession, setSession])

  return (
    <SessionContext value={value}>
      {children}
    </SessionContext>
  )
}
