import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { type PropsWithChildren, StrictMode } from 'react'
import { expect, it, vi } from 'vitest'

import { createQueryClient } from '@/app/lib/query-client'
import { chatQueryKey, messageQueryKey } from '@/pages/chat/api/chat-query-key'
import { useNotifications } from '@/pages/chat/api/use-notifications'
import { createDemoAdapter, type Notification } from '@/shared/api'
import { AppError } from '@/shared/errors'
import type { Session } from '@/shared/session'

it('подтверждает неподдерживаемое событие, затем добавляет личный текст в нужный новый чат', async () => {
  const client = createQueryClient(vi.fn())
  const adapter = createDemoAdapter('max')
  const session: Session = { id: 'real-notifications', messenger: 'max', adapter }
  const chat = { id: 'new-chat', title: 'Собеседник', phone: '+79991234567' }
  const message = {
    id: 'incoming-1', chatId: chat.id, direction: 'incoming' as const,
    author: chat.title, text: '<b>ответ</b>', timestamp: 1763115112000,
  }
  client.setQueryData(chatQueryKey(session), [])
  vi.spyOn(adapter, 'receiveNotification')
    .mockResolvedValueOnce({ receiptId: '1', message: null })
    .mockResolvedValueOnce({ receiptId: '2', chat, message })
    .mockResolvedValue(null)
  vi.spyOn(adapter, 'getMessages').mockResolvedValue([message])
  const acknowledge = vi.spyOn(adapter, 'acknowledgeNotification').mockResolvedValue()
  const view = renderHook(() => useNotifications(session), {
    wrapper: ({ children }: PropsWithChildren) => (<QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>),
  })
  try {
    await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(2))
    expect(acknowledge.mock.calls.map(([id]) => id)).toEqual(['1', '2'])
    expect(client.getQueryData(chatQueryKey(session))).toEqual([chat])
    expect(client.getQueryData(messageQueryKey(session, chat.id))).toEqual([message])
  } finally {
    view.unmount()
    client.clear()
  }
})

it('восстанавливает получение с задержкой, показывает одну локальную ошибку и останавливается при отказе авторизации', async () => {
  vi.useFakeTimers()
  const reportError = vi.fn()
  const client = createQueryClient(reportError)
  const adapter = createDemoAdapter('max')
  const receive = vi.spyOn(adapter, 'receiveNotification')
    .mockRejectedValueOnce(new AppError('network'))
    .mockResolvedValueOnce(null)
    .mockRejectedValue(new AppError('unauthorized'))
  const session: Session = { id: 'failures', messenger: 'max', adapter }
  const view = renderHook(() => useNotifications(session), {
    wrapper: ({ children }: PropsWithChildren) => (<QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>),
  })
  try {
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(view.result.current.error).toEqual(new AppError('network'))
    await act(() => vi.advanceTimersByTimeAsync(1998))
    expect(receive).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(3))
    expect(view.result.current.isSuccess).toBe(true)
    await act(() => vi.advanceTimersByTimeAsync(402))
    expect(view.result.current.error).toEqual(new AppError('unauthorized'))
    await act(() => vi.advanceTimersByTimeAsync(10000))
    expect(receive).toHaveBeenCalledTimes(3)
    expect(reportError).not.toHaveBeenCalled()
  } finally {
    view.unmount()
    client.clear()
    vi.useRealTimers()
  }
})

it('отменяет старый цикл при смене сессии и игнорирует поздний ответ после очистки кеша', async () => {
  const client = createQueryClient(vi.fn())
  const adapter = createDemoAdapter('max')
  let resolve!: (notification: Notification) => void
  const pending = new Promise<Notification>(done => { resolve = done })
  const receive = vi.spyOn(adapter, 'receiveNotification').mockReturnValue(pending)
  const acknowledge = vi.spyOn(adapter, 'acknowledgeNotification')
  const oldSession: Session = { id: 'old', messenger: 'max', adapter }
  const nextAdapter = createDemoAdapter('telegram')
  const nextReceive = vi.spyOn(nextAdapter, 'receiveNotification').mockResolvedValue(null)
  const nextSession: Session = { id: 'next', messenger: 'telegram', adapter: nextAdapter }
  const view = renderHook(({ session }) => useNotifications(session), {
    initialProps: { session: oldSession },
    wrapper: ({ children }: PropsWithChildren) => (
      <StrictMode>
        <QueryClientProvider client={client}>
          {children}
        </QueryClientProvider>
      </StrictMode>
    ),
  })
  await act(async () => { await client.cancelQueries(); client.clear() })
  view.rerender({ session: nextSession })
  await act(async () => {
    resolve({ receiptId: 'late', message: {
      id: 'late', chatId: 'demo-max-1', direction: 'incoming', author: 'Анна', text: 'Поздний ответ', timestamp: 0,
    } })
  })
  expect(receive.mock.calls.every(([signal]) => signal.aborted)).toBe(true)
  expect(acknowledge).not.toHaveBeenCalled()
  expect(client.getQueryData(messageQueryKey(oldSession, 'demo-max-1'))).toBeUndefined()
  expect(nextReceive).toHaveBeenCalledTimes(1)
  view.unmount()
  client.clear()
})
