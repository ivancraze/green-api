import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import type { Chat } from '@/shared/api'
import type { Session } from '@/shared/session'

import { chatQueryKey } from './chat-query-key'

export function useCreateChat(session: Session, onCreated: (chat: Chat) => void) {
  const queryClient = useQueryClient()
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  return useMutation({
    retry: false,
    mutationFn: async (phone: string) => {
      controllerRef.current?.abort()
      const request = new AbortController()
      controllerRef.current = request
      const chat = await session.adapter.resolveRecipient(phone, request.signal)
      return { chat, signal: request.signal }
    },
    onSuccess: async ({ chat, signal }) => {
      if (signal.aborted) return
      // Фоновое чтение списка не должно затереть только что созданный чат.
      await queryClient.cancelQueries({ queryKey: chatQueryKey(session), exact: true })
      if (signal.aborted) return
      queryClient.setQueryData<Chat[]>(chatQueryKey(session), (chats = []) => (
        chats.some(existing => existing.id === chat.id) ? chats : [...chats, chat]
      ))
      onCreated(chat)
    },
  })
}
