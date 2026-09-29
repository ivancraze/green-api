import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import type { Message } from '@/shared/api'
import type { Session } from '@/shared/session'

import { messageQueryKey } from './chat-query-key'

export function useSendText(session: Session, chatId: string, onSent: () => void) {
  const queryClient = useQueryClient()
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const mutation = useMutation({
    retry: false,
    mutationFn: ({ text, request }: { text: string, request: AbortController }) => (
      session.adapter.sendText(chatId, text, request.signal)
    ),
    onSuccess: async (message, { request }) => {
      if (request.signal.aborted) return
      // Фоновое чтение истории не должно затереть принятое сообщение.
      await queryClient.cancelQueries({ queryKey: messageQueryKey(session, chatId), exact: true })
      if (request.signal.aborted) return
      queryClient.setQueryData<Message[]>(messageQueryKey(session, chatId), (messages = []) => (
        messages.some(existing => existing.id === message.id) ? messages : [...messages, message]
      ))
      onSent()
    },
    onSettled: () => { controllerRef.current = null },
  })

  function send(text: string) {
    // Защита также действует до рендера isPending и при отправке формы с клавиатуры.
    if (!text.trim() || controllerRef.current) return
    const request = new AbortController()
    controllerRef.current = request
    mutation.mutate({ text, request })
  }

  return { send, isPending: mutation.isPending }
}
