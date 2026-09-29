import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Message } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import type { ChatSession } from '@/shared/session'

import { messageQueryKey } from './chat-query-key'

export function useNotifications(session: ChatSession) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['session', session.id, session.messenger, 'notifications'],
    queryFn: async ({ signal }) => {
      const notification = await session.adapter.receiveNotification(signal)
      signal.throwIfAborted()
      if (!notification) return null

      const { message, receiptId } = notification
      const queryKey = messageQueryKey(session, message.chatId)
      // Не создаём неполную историю для ещё не открытого чата.
      await queryClient.ensureQueryData({
        queryKey,
        queryFn: ({ signal: historySignal }) => session.adapter.getMessages(
          message.chatId, AbortSignal.any([signal, historySignal]),
        ),
        retry: false,
        meta: { errorHandling: 'local' },
      })
      signal.throwIfAborted()
      await queryClient.cancelQueries({ queryKey, exact: true })
      signal.throwIfAborted()
      queryClient.setQueryData<Message[]>(queryKey, (messages = []) => (
        messages.some(existing => existing.id === message.id) ? messages : [...messages, message]
      ))
      await session.adapter.acknowledgeNotification(receiptId, signal)
      signal.throwIfAborted()
      return null
    },
    meta: { errorHandling: 'local' },
    retry: false,
    refetchInterval: query => {
      if (query.state.error) {
        return normalizeError(query.state.error).code === 'unauthorized' ? false : 2000
      }
      return 400
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
