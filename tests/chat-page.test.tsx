import { QueryClientProvider } from '@tanstack/react-query'
import type {} from '@testing-library/jest-dom/vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { StrictMode } from 'react'
import {
  afterAll,
  beforeAll,
  expect,
  it,
  vi
} from 'vitest'

import { App } from '@/app'
import { createQueryClient } from '@/app/lib/query-client'
import { ChatPage } from '@/pages/chat'
import { Conversation } from '@/pages/chat/ui/Conversation'
import { createDemoAdapter, type Message } from '@/shared/api'
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

it('сохраняет отдельные черновики при переключении, очищает отправленный и сбрасывает их при выходе', async () => {
  render(<StrictMode>
    <App />
  </StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Войти в демо' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  expect(screen.getByRole('region', { name: 'Разговор: Анна · MAX' })).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Черновик' } })
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Черновик')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())

  fireEvent.click(screen.getByRole('menuitem', { name: 'Борис · MAX' }))
  expect(screen.getByRole('region', { name: 'Разговор: Борис · MAX' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('')
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Текст Борису' } })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Анна · MAX' }))
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Черновик')
  await waitFor(() => expect(screen.getByRole('button', { name: /Отправить/ })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /Отправить/ }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue(''))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Борис · MAX' }))
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Текст Борису')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Анна · MAX' }))
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
  expect(screen.getByRole('button', { name: 'Войти в демо' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Войти в демо' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Борис · MAX' }))
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('')
})

it('отмечает входящие прочитанными после открытия реального разговора', async () => {
  const reportError = vi.fn()
  const client = createQueryClient(reportError)
  const adapter = createDemoAdapter('telegram')
  const chat = (await adapter.getChats(new AbortController().signal))[0]
  const readChat = vi.spyOn(adapter, 'readChat')
  const session = {
    id: 'real-read', messenger: 'telegram' as const, adapter,
    credentials: { messenger: 'telegram' as const, apiUrl: 'https://example.test', idInstance: '1', apiTokenInstance: 'test' },
  }
  const view = render(<QueryClientProvider client={client}>
    <Conversation
      chat={chat}
      draft=""
      onBack={vi.fn()}
      onDraftChange={vi.fn()}
      sendingEnabled
      session={session}
    />
  </QueryClientProvider>)
  try {
    await waitFor(() => expect(readChat).toHaveBeenCalledOnce())
    expect(readChat).toHaveBeenCalledWith(chat.id, expect.any(AbortSignal))
    await waitFor(() => expect(client.getQueryCache().findAll({
      queryKey: ['session', session.id, session.messenger, 'read-chat', chat.id],
    }).some(query => query.state.data === true)).toBe(true))
    expect(reportError).not.toHaveBeenCalled()
  } finally {
    view.unmount()
    client.clear()
  }
})

function renderChat(adapter = createDemoAdapter('max')) {
  const reportError = vi.fn()
  const client = createQueryClient(reportError)
  const session: Session = { id: 'test-session', messenger: 'max', adapter, demo: { setFailures: adapter.setFailures } }
  const view = render(
    <QueryClientProvider client={client}>
      <SessionContext value={{ session, setSession: vi.fn() }}>
        <ChatPage session={session} />
      </SessionContext>
    </QueryClientProvider>,
  )
  return { ...view, client, reportError }
}

it('управляет отказом подключения и позволяет повторить демовход', async () => {
  render(<App />)
  const failure = screen.getByRole('checkbox', { name: 'Отказ подключения (демо)' })
  fireEvent.click(failure)
  fireEvent.click(screen.getByRole('button', { name: 'Войти в демо' }))
  await waitFor(() => expect(failure).toBeDisabled())
  expect(await screen.findByText(new AppError('unauthorized').message)).toBeInTheDocument()
  await waitFor(() => expect(failure).toBeEnabled())
  fireEvent.click(failure)
  fireEvent.click(screen.getByRole('button', { name: /Войти в демо/ }))
  expect(await screen.findByRole('menuitem', { name: 'Анна · MAX' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
  expect(screen.getByRole('checkbox', { name: 'Отказ подключения (демо)' })).not.toBeChecked()
})

it('восстанавливает отправку вручную и получение автоматически через переключатели отказов', async () => {
  const { client, reportError, unmount } = renderChat()
  try {
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
    await screen.findByText('Привет! Это тестовый чат MAX.')
    fireEvent.click(screen.getByRole('button', { name: 'Демоотказы' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Отказ отправки' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Отказ получения' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const draft = screen.getByRole('textbox', { name: 'Сообщение' })
    fireEvent.change(draft, { target: { value: 'Восстановление демо' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
    expect(draft).toHaveValue('Восстановление демо')
    expect(await screen.findByRole('alert')).toHaveTextContent(new AppError('network').message)
    fireEvent.click(screen.getByRole('button', { name: 'Демоотказы' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Отказ отправки' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(draft).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Отправить/ }))
    const history = within(screen.getByRole('region', { name: 'История сообщений' }))
    expect(await history.findByText('Восстановление демо')).toBeVisible()
    await waitFor(() => expect(draft).toHaveValue(''))
    fireEvent.click(screen.getByRole('button', { name: 'Демоотказы' }))
    expect(screen.getByRole('checkbox', { name: 'Отказ получения' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Отказ получения' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(await within(screen.getByRole('region', { name: 'История сообщений' })).findByText('Тестовый ответ: Восстановление демо', {}, { timeout: 4000 })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(reportError).toHaveBeenCalledTimes(1)
  } finally {
    unmount()
    client.clear()
  }
}, 10000)

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

it('повторяет временный отказ сервера при реальной загрузке списка без показа ошибки', async () => {
  const adapter = createDemoAdapter('max')
  const getChats = vi.spyOn(adapter, 'getChats').mockRejectedValueOnce(new AppError('http', 503))
  const client = createQueryClient(vi.fn())
  const session = {
    id: 'real-retry', messenger: 'max' as const, adapter,
    credentials: { messenger: 'max' as const, apiUrl: 'https://example.test', idInstance: '1', apiTokenInstance: 'synthetic-token' },
  }
  const view = render(<QueryClientProvider client={client}>
    <SessionContext value={{ session, setSession: vi.fn() }}>
      <ChatPage session={session} />
    </SessionContext>
  </QueryClientProvider>)
  try {
    expect(await screen.findByRole('menuitem', { name: 'Анна · MAX' }, { timeout: 3500 })).toBeVisible()
    expect(getChats).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  } finally {
    view.unmount()
    client.clear()
  }
})

it('загружает историю с автором и временем, выводит HTML как текст и открывает пустой чат', async () => {
  const { client } = renderChat()
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  const history = screen.getByRole('region', { name: 'История сообщений' })
  expect(history).toHaveAttribute('aria-busy', 'true')
  expect(within(history).queryByText('Сообщений пока нет')).not.toBeInTheDocument()
  expect(await within(history).findByText('Привет! Это тестовый чат MAX.')).toBeVisible()
  expect(within(history).getAllByText('Анна · MAX')).toHaveLength(2)
  expect(within(history).getByText('Вы')).toBeVisible()
  expect(within(history).getByText('Привет! Проверяю отправку текста.')).toBeVisible()
  const html = within(history).getByText('<b>Это обычный текст, а не HTML.</b>')
  expect(html).toBeVisible()
  expect(html.querySelector('b')).toBeNull()
  const times = history.querySelectorAll('time')
  expect(times).toHaveLength(3)
  expect(times[0]).toHaveAttribute('datetime', '2026-01-01T12:00:00.000Z')
  expect(times[0]).toHaveTextContent(new Date('2026-01-01T12:00:00Z').toLocaleString('ru-RU'))

  fireEvent.click(screen.getByRole('menuitem', { name: 'Борис · MAX' }))
  expect(within(screen.getByRole('region', { name: 'История сообщений' })).queryByText('Привет! Это тестовый чат MAX.')).not.toBeInTheDocument()
  expect(await screen.findByText('Сообщений пока нет')).toBeVisible()
  client.clear()
})

it('показывает безопасную ошибку истории без общего уведомления и повторяет загрузку', async () => {
  const adapter = createDemoAdapter('max')
  vi.spyOn(adapter, 'getMessages').mockRejectedValueOnce(new AppError('network'))
  const { client, reportError } = renderChat(adapter)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(new AppError('network').message)
  expect(reportError).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }))
  expect(await screen.findByText('Привет! Это тестовый чат MAX.')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  client.clear()
})

async function submitPhone(phone: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Создать чат/ })).toBeEnabled())
  fireEvent.change(screen.getByRole('textbox', { name: 'Телефон' }), { target: { value: phone } })
  fireEvent.click(screen.getByRole('button', { name: /Создать чат/ }))
}

it('создаёт чат по нормализованному телефону и повторно открывает его без дубля', async () => {
  const { client } = renderChat()
  await screen.findByRole('menuitem', { name: 'Анна · MAX' })
  await submitPhone('+7 (900) 555-33-22')
  expect(await screen.findByRole('region', { name: 'Разговор: +79005553322' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Телефон' })).toHaveValue('')

  fireEvent.click(screen.getByRole('menuitem', { name: 'Анна · MAX' }))
  await submitPhone('+79005553322')
  expect(await screen.findByRole('region', { name: 'Разговор: +79005553322' })).toBeVisible()
  expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  client.clear()
})

it('не отправляет пустой текст и повторы, добавляет успешное сообщение и очищает черновик', async () => {
  const adapter = createDemoAdapter('max')
  const send = vi.spyOn(adapter, 'sendText')
  const { client } = renderChat(adapter)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  await screen.findByText('Привет! Это тестовый чат MAX.')
  const input = screen.getByRole('textbox', { name: 'Сообщение' })
  const button = screen.getByRole('button', { name: 'Отправить' })
  expect(input.closest('form')).toBeNull()
  const history = within(screen.getByRole('region', { name: 'История сообщений' }))
  expect(button).toBeDisabled()
  fireEvent.change(input, { target: { value: ' \n ' } })
  await act(async () => { fireEvent.click(button) })
  expect(button).toBeDisabled()
  expect(send).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: ' Новый текст ' } })
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(send).not.toHaveBeenCalled()
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.keyDown(window, { key: 'Enter' }); fireEvent.click(button) })
  await waitFor(() => expect(button).toBeDisabled())
  expect(input).toBeDisabled()
  expect(input).toHaveValue(' Новый текст ')
  expect(history.queryByText('Новый текст')).not.toBeInTheDocument()
  await act(async () => { fireEvent.click(button) })
  expect(await history.findByText('Новый текст')).toBeVisible()
  expect(send).toHaveBeenCalledExactlyOnceWith('demo-max-1', ' Новый текст ', expect.any(AbortSignal))
  expect(screen.getByRole('region', { name: 'История сообщений' }).querySelectorAll('time')).toHaveLength(4)
  expect(input).toHaveValue('')
  client.clear()
})

it('глобальный Enter нажимает отправку при фокусе в другом поле или на кнопке и отключается после выхода', async () => {
  const adapter = createDemoAdapter('max')
  const send = vi.spyOn(adapter, 'sendText')
  const { client, unmount } = renderChat(adapter)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  await screen.findByText('Привет! Это тестовый чат MAX.')
  const input = screen.getByRole('textbox', { name: 'Сообщение' })
  const button = screen.getByRole('button', { name: 'Отправить' })
  const newChat = screen.getByRole('button', { name: 'Новый чат' })
  const history = within(screen.getByRole('region', { name: 'История сообщений' }))
  for (const [index, target] of [newChat, button].entries()) {
    const text = `Глобальная отправка ${index}`
    fireEvent.change(input, { target: { value: text } })
    target.focus()
    fireEvent.keyDown(target, { key: 'Enter' })
    expect(await history.findByText(text)).toBeVisible()
    expect(send).toHaveBeenCalledTimes(index + 1)
  }
  unmount()
  client.clear()
  expect(fireEvent.keyDown(window, { key: 'Enter' })).toBe(true)
  expect(send).toHaveBeenCalledTimes(2)
})

it('сохраняет черновик при отказе без автоматического retry и допускает ручную отправку', async () => {
  const adapter = createDemoAdapter('max')
  adapter.setFailures({ send: true })
  const send = vi.spyOn(adapter, 'sendText')
  const { client, reportError } = renderChat(adapter)
  client.setDefaultOptions({ mutations: { retry: 3 } })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  await screen.findByText('Привет! Это тестовый чат MAX.')
  const input = screen.getByRole('textbox', { name: 'Сообщение' })
  const button = screen.getByRole('button', { name: 'Отправить' })
  const history = within(screen.getByRole('region', { name: 'История сообщений' }))
  fireEvent.change(input, { target: { value: 'Повторная попытка' } })
  fireEvent.click(button)
  await waitFor(() => expect(reportError).toHaveBeenCalledExactlyOnceWith(new AppError('network')))
  await waitFor(() => expect(button).toBeEnabled())
  expect(send).toHaveBeenCalledTimes(1)
  expect(input).toHaveValue('Повторная попытка')
  expect(history.queryByText('Повторная попытка')).not.toBeInTheDocument()
  adapter.setFailures({})
  fireEvent.click(button)
  expect(await history.findByText('Повторная попытка')).toBeVisible()
  expect(input).toHaveValue('')
  expect(send).toHaveBeenCalledTimes(2)
  client.clear()
})

it('отменяет отправку при размонтировании и не восстанавливает очищенный кеш поздним ответом', async () => {
  const adapter = createDemoAdapter('max')
  let resolve!: (message: Message) => void
  const pending = new Promise<Message>(done => { resolve = done })
  const send = vi.spyOn(adapter, 'sendText').mockReturnValue(pending)
  const { client, unmount } = renderChat(adapter)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  await screen.findByText('Привет! Это тестовый чат MAX.')
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Поздний ответ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  const signal = send.mock.calls[0][2]
  unmount()
  client.clear()
  expect(signal.aborted).toBe(true)
  await act(async () => {
    resolve({ id: 'late', chatId: 'demo-max-1', direction: 'outgoing', author: 'Вы', text: 'Поздний ответ', timestamp: 0 })
  })
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

it('получает ответ в другом чате и повторяет подтверждение без дубля под StrictMode', async () => {
  const adapter = createDemoAdapter('max')
  const receiveNotification = adapter.receiveNotification
  let active = 0
  let maxActive = 0
  const receive = vi.spyOn(adapter, 'receiveNotification').mockImplementation(signal => {
    maxActive = Math.max(maxActive, ++active)
    let finished = false
    const finish = () => {
      if (!finished) active--
      finished = true
      signal.removeEventListener('abort', finish)
    }
    signal.addEventListener('abort', finish, { once: true })
    return receiveNotification(signal).finally(finish)
  })
  const acknowledge = vi.spyOn(adapter, 'acknowledgeNotification')
    .mockRejectedValueOnce(new AppError('network'))
  const client = createQueryClient(vi.fn())
  const session: Session = { id: 'reply-session', messenger: 'max', adapter }
  const view = render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <SessionContext value={{ session, setSession: vi.fn() }}>
          <ChatPage session={session} />
        </SessionContext>
      </QueryClientProvider>
    </StrictMode>,
  )
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
  await screen.findByText('Привет! Это тестовый чат MAX.')
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Ответ в фоне' } })
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
  await within(screen.getByRole('region', { name: 'История сообщений' })).findByText('Ответ в фоне')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Борис · MAX' }))
  expect(await screen.findByText('Сообщений пока нет')).toBeVisible()
  await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(2), { timeout: 5000 })
  expect(within(screen.getByRole('region', { name: 'История сообщений' })).queryByText('Тестовый ответ: Ответ в фоне')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Анна · MAX' }))
  expect(await within(screen.getByRole('region', { name: 'История сообщений' })).findAllByText('Тестовый ответ: Ответ в фоне')).toHaveLength(1)
  const firstSignal = receive.mock.calls[0][0]
  expect(firstSignal.aborted).toBe(true)
  expect(maxActive).toBe(1)
  expect(acknowledge.mock.calls[0][0]).toBe(acknowledge.mock.calls[1][0])
  view.unmount()
  client.clear()
}, 8000)

it('обновляет превью из кеша, не запрашивая историю ради списка', async () => {
  const adapter = createDemoAdapter('max')
  const getMessages = vi.spyOn(adapter, 'getMessages')
  const { client, unmount } = renderChat(adapter)
  try {
    const anna = await screen.findByRole('menuitem', { name: 'Анна · MAX' })
    expect(getMessages).not.toHaveBeenCalled()
    fireEvent.click(anna)
    await within(screen.getByRole('region', { name: 'История сообщений' })).findByText('<b>Это обычный текст, а не HTML.</b>')
    expect(getMessages).toHaveBeenCalledTimes(1)
    expect(getMessages.mock.calls[0][0]).toBe('demo-max-1')
    expect(within(anna).getByText('<b>Это обычный текст, а не HTML.</b>')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Назад к списку чатов' }))
    expect(screen.queryByRole('textbox', { name: 'Сообщение' })).not.toBeInTheDocument()
    act(() => client.setQueryData(['session', 'test-session', 'max', 'messages', 'demo-max-1'], [{
      id: 'preview', chatId: 'demo-max-1', direction: 'incoming', author: 'Анна', text: 'Новое превью', timestamp: 0,
    }]))
    expect(await within(anna).findByText('Новое превью')).toBeVisible()
    expect(getMessages).toHaveBeenCalledTimes(1)
  } finally {
    unmount()
    client.clear()
  }
})

it('Enter в Modal не отправляет черновик, закрытие отменяет создание', async () => {
  const adapter = createDemoAdapter('max')
  const send = vi.spyOn(adapter, 'sendText')
  const { client, unmount } = renderChat(adapter)
  try {
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Анна · MAX' }))
    await within(screen.getByRole('region', { name: 'История сообщений' })).findByText('Привет! Это тестовый чат MAX.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Сохранить черновик' } })
    fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }))
    const phone = screen.getByRole('textbox', { name: 'Телефон' })
    expect(fireEvent.keyDown(phone, { key: 'Enter' })).toBe(true)
    expect(send).not.toHaveBeenCalled()
    let resolve!: (chat: { id: string, title: string, phone: string }) => void
    const creation = vi.spyOn(adapter, 'resolveRecipient').mockReturnValue(new Promise(done => { resolve = done }))
    fireEvent.change(phone, { target: { value: '+79005553322' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать чат' }))
    await waitFor(() => expect(creation).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(creation.mock.calls[0][1].aborted).toBe(true)
    await act(async () => { resolve({ id: 'late-chat', title: 'Поздний чат', phone: '+79005553322' }) })
    expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Сохранить черновик')
    expect(screen.queryByRole('menuitem', { name: 'Поздний чат' })).not.toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
  } finally {
    unmount()
    client.clear()
  }
})
