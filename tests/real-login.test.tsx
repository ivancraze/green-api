import { QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { StrictMode } from 'react'
import {
  afterEach,
  expect,
  it,
  vi
} from 'vitest'

import { createQueryClient } from '@/app/lib/query-client'
import { AppRouter } from '@/app/router'
import { SessionProvider } from '@/shared/session'

function renderLogin() {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
    matches: false, media, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
  window.history.replaceState(null, '', '/login')
  const reportError = vi.fn()
  const client = createQueryClient(reportError)
  const view = render(<StrictMode>
    <QueryClientProvider client={client}>
      <SessionProvider>
        <AppRouter />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>)
  return { ...view, client, reportError }
}

function fillCredentials() {
  fireEvent.click(screen.getByRole('radio', { name: 'Реальное подключение' }))
  fireEvent.change(screen.getByLabelText('apiUrl'), { target: { value: 'https://api.example.test' } })
  fireEvent.change(screen.getByLabelText('idInstance'), { target: { value: '123' } })
  fireEvent.change(screen.getByLabelText('apiTokenInstance'), { target: { value: 'synthetic-token' } })
  fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }))
}
afterEach(() => vi.unstubAllGlobals())

it('сохраняет ввод при отказе, входит после ручного повтора и очищает сессию/кеш при выходе', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(Response.json({ stateInstance: 'authorized' }))
    .mockImplementation((url: string) => Promise.resolve(Response.json(/\/(getChats|lastIncomingMessages|lastOutgoingMessages)\//.test(url) ? [] : null)))
  vi.stubGlobal('fetch', fetchMock)
  const { client, reportError, unmount } = renderLogin()
  fillCredentials()
  await waitFor(() => expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ code: 'unauthorized' })))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('synthetic-token')
  expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state))).not.toContain('synthetic-token')
  fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }))
  expect(await screen.findByText('Реальное подключение: MAX')).toBeVisible()
  expect(window.location.pathname).toBe('/max')
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/waInstance123/receiveNotification/synthetic-token',
    expect.objectContaining({ method: 'GET' }),
  )
  expect(client.getQueryCache().getAll().map(query => query.queryKey).flat()).not.toContain('synthetic-token')
  expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state))).not.toContain('synthetic-token')
  client.setQueryData(['old-data'], 'old')
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
  expect(await screen.findByRole('button', { name: 'Войти в демо' })).toBeVisible()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  fireEvent.click(screen.getByRole('radio', { name: 'Реальное подключение' }))
  expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('')
  unmount()
  renderLogin()
  expect(screen.getByRole('button', { name: 'Войти в демо' })).toBeVisible()
})

it('блокирует повторный вход и отменяет запрос при размонтировании, игнорируя поздний ответ', async () => {
  let resolve!: (response: Response) => void
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(done => { resolve = done }))
  vi.stubGlobal('fetch', fetchMock)
  const { unmount, client } = renderLogin()
  fillCredentials()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText('apiTokenInstance')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Подключиться/ }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
  unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(Response.json({ stateInstance: 'authorized' })))
  expect(client.getMutationCache().getAll()[0]?.state.data).toBeUndefined()
  expect(window.location.pathname).toBe('/login')
})

it('после реального входа в WhatsApp открывает общий чат', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ stateInstance: 'authorized' }))
    .mockImplementation((url: string) => Promise.resolve(Response.json(/\/(getChats|lastIncomingMessages|lastOutgoingMessages)\//.test(url) ? [] : null))))
  const { unmount } = renderLogin()
  fireEvent.click(screen.getByRole('radio', { name: 'WhatsApp' }))
  fillCredentials()
  expect(await screen.findByText('Реальное подключение: WhatsApp')).toBeVisible()
  expect(window.location.pathname).toBe('/whatsapp')
  expect(await screen.findByText('Чатов пока нет')).toBeVisible()
  unmount()
})

it('после реального входа в Telegram открывает общий чат', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ stateInstance: 'authorized' }))
    .mockImplementation((url: string) => Promise.resolve(Response.json(/\/(getChats|lastIncomingMessages|lastOutgoingMessages)\//.test(url) ? [] : null))))
  const { unmount } = renderLogin()
  fireEvent.click(screen.getByRole('radio', { name: 'Telegram' }))
  fillCredentials()
  expect(await screen.findByText('Реальное подключение: Telegram')).toBeVisible()
  expect(window.location.pathname).toBe('/telegram')
  expect(await screen.findByText('Чатов пока нет')).toBeVisible()
  unmount()
})
