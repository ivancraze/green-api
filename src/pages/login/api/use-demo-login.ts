import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { createDemoAdapter, type Messenger } from '@/shared/api'
import { useSession } from '@/shared/session'

export function useDemoLogin() {
  const { setSession } = useSession()
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  return useMutation({
    retry: false,
    mutationFn: async (messenger: Messenger) => {
      controllerRef.current?.abort()
      const request = new AbortController()
      controllerRef.current = request
      const adapter = createDemoAdapter(messenger)
      await adapter.checkConnection(request.signal)
      return { id: crypto.randomUUID(), messenger, adapter }
    },
    onSuccess: (session) => {
      if (!controllerRef.current?.signal.aborted) setSession(session)
    },
  })
}
