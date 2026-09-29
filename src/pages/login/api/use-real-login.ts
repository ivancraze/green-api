import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { checkRealConnection, type ConnectionCredentials, createMaxAdapter, createWhatsappAdapter, normalizeCredentials } from '@/shared/api'
import { useSession } from '@/shared/session'

export function useRealLogin() {
  const { setSession } = useSession()
  const pendingRef = useRef<{ credentials: ConnectionCredentials, controller: AbortController } | null>(null)
  useEffect(() => () => {
    pendingRef.current?.controller.abort()
    pendingRef.current = null
  }, [])

  // Credentials не передаются в variables и не возвращаются в data мутации.
  const mutation = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const request = pendingRef.current
      if (!request) return
      try {
        const credentials = normalizeCredentials(request.credentials)
        await checkRealConnection(credentials, request.controller.signal)
        request.controller.signal.throwIfAborted()
        setSession({
          id: crypto.randomUUID(),
          messenger: credentials.messenger,
          credentials,
          ...(credentials.messenger === 'max' ? { adapter: createMaxAdapter(credentials) } : {}),
          ...(credentials.messenger === 'whatsapp' ? { adapter: createWhatsappAdapter(credentials) } : {}),
        })
      }
      finally {
        if (pendingRef.current === request) pendingRef.current = null
      }
    },
  })

  return {
    isPending: mutation.isPending,
    connect: (credentials: ConnectionCredentials) => {
      if (pendingRef.current) return
      pendingRef.current = { credentials, controller: new AbortController() }
      mutation.mutate()
    },
  }
}
