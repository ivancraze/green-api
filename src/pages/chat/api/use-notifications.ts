import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Chat, Message } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import type { ChatSession } from '@/shared/session'

import { chatQueryKey, messageQueryKey } from './chat-query-key'

export function useNotifications(session: ChatSession) {
  const queryClient = useQueryClient()

  return useQuery({
    enabled: true,
    queryKey: ['session', session.id, session.messenger, 'notifications'],
    queryFn: async ({ signal }) => {
      const notification = await session.adapter.receiveNotification(signal)
      signal.throwIfAborted()
      if (!notification) return null

      const { chat, message, receiptId } = notification
      if (chat) {
        const chatsKey = chatQueryKey(session)
        signal.throwIfAborted()
        queryClient.setQueryData<Chat[]>(chatsKey, current => (
          current?.some(existing => existing.id === chat.id) ? current : [...(current ?? []), chat]
        ))
      }
      if (message) {
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
          messages.some(existing => existing.id === message.id)
            ? messages.map(existing => existing.id === message.id ? message : existing)
            : [...messages, message]
        ))
      }
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
