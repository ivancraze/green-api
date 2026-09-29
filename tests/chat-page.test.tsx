import { QueryClientProvider } from '@tanstack/react-query'
import type {} from '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import { App } from '@/app'
import { createQueryClient } from '@/app/lib/query-client'
import { ChatPage } from '@/pages/chat'
import { createDemoAdapter } from '@/shared/api'
import { AppError } from '@/shared/errors'
import { type Session, SessionContext } from '@/shared/session/session-context'

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
    matches: false, media, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
})
afterAll(() => vi.unstubAllGlobals())

it('открывает чат, переключает разговор и выходит', async () => {
  render(<StrictMode>
    <App />
  </StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Войти в демо' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  expect(screen.getByRole('heading', { name: 'Анна · MAX' })).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Черновик' } })
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Черновик')
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()

  fireEvent.click(screen.getByRole('menuitem', { name: 'Борис · MAX' }))
  expect(screen.getByRole('heading', { name: 'Борис · MAX' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
  expect(screen.getByRole('button', { name: 'Войти в демо' })).toBeVisible()
})

function renderChat(adapter = createDemoAdapter('max')) {
  const client = createQueryClient(vi.fn())
  const session: Session = { id: 'test-session', messenger: 'max', adapter }
  const view = render(
    <QueryClientProvider client={client}>
      <SessionContext value={{ session, setSession: vi.fn() }}>
        <ChatPage session={session} />
      </SessionContext>
    </QueryClientProvider>,
  )
  return { ...view, client }
}

it('показывает пустой список после загрузки', async () => {
  const adapter = createDemoAdapter('max')
  vi.spyOn(adapter, 'getChats').mockResolvedValue([])
  const { client } = renderChat(adapter)
  expect(await screen.findByText('Чатов пока нет')).toBeVisible()
  expect(screen.getByText('Выберите чат из списка')).toBeVisible()
  client.clear()
})

it('показывает локальную безопасную ошибку и позволяет повторить загрузку', async () => {
  const adapter = createDemoAdapter('max')
  vi.spyOn(adapter, 'getChats').mockRejectedValueOnce(new AppError('network'))
  const { client } = renderChat(adapter)
  expect(await screen.findByRole('alert')).toHaveTextContent(new AppError('network').message)
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }))
  expect(await screen.findByRole('menuitem', { name: 'Анна · MAX' })).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  client.clear()
})

async function submitPhone(phone: string) {
  await waitFor(() => expect(screen.getByRole('button', { name: /Создать чат/ })).toBeEnabled())
  fireEvent.change(screen.getByRole('textbox', { name: 'Телефон' }), { target: { value: phone } })
  fireEvent.click(screen.getByRole('button', { name: /Создать чат/ }))
}

it('создаёт чат по нормализованному телефону и повторно открывает его без дубля', async () => {
  const { client } = renderChat()
  await screen.findByRole('menuitem', { name: 'Анна · MAX' })
  await submitPhone('+7 (900) 555-33-22')
  expect(await screen.findByRole('heading', { name: '+79005553322' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Телефон' })).toHaveValue('')

  fireEvent.click(screen.getByRole('menuitem', { name: 'Анна · MAX' }))
  await submitPhone('+79005553322')
  expect(await screen.findByRole('heading', { name: '+79005553322' })).toBeVisible()
  expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  client.clear()
})
