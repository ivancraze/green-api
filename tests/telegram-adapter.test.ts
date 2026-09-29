import {
  afterEach,
  expect,
  it,
  vi
} from 'vitest'

import { type ConnectionCredentials, createTelegramAdapter } from '@/shared/api'

const credentials: ConnectionCredentials = {
  messenger: 'telegram', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
}
afterEach(() => vi.unstubAllGlobals())

function stubHistoryFetch(fetchMock: (url: string, init: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    if (/\/(getChats|getChatHistory|lastIncomingMessages|lastOutgoingMessages)\//.test(url)) return Promise.resolve(Response.json([]))
    return fetchMock(url, init)
  })
}

it('создаёт чат по возвращённому Telegram chatId, отправляет и принимает личный текст без дубля', async () => {
  const incoming = { receiptId: 7, body: {
    typeWebhook: 'incomingMessageReceived', idMessage: 'incoming-1', timestamp: 1763115112,
    senderData: { chatId: '10000000', chatType: 'user', senderName: 'Собеседник', senderPhoneNumber: 79991234567 },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '<b>ответ</b>' } },
  } }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ exist: true, chatId: '10000000' }))
    .mockResolvedValueOnce(Response.json({ idMessage: 'outgoing-1' }))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json({ result: true }))
  stubHistoryFetch(fetchMock)
  const adapter = createTelegramAdapter(credentials)
  const signal = new AbortController().signal
  const chat = await adapter.resolveRecipient('+79991234567', signal)
  expect(chat).toEqual({ id: '10000000', title: '+79991234567', phone: '+79991234567' })
  await adapter.resolveRecipient('+79991234567', signal)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenNthCalledWith(1,
    'https://api.example.test/waInstance123/checkAccount/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"phoneNumber":79991234567}', signal }),
  )
  const sent = await adapter.sendText(chat.id, 'Привет', signal)
  expect(fetchMock).toHaveBeenNthCalledWith(2,
    'https://api.example.test/waInstance123/sendMessage/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"chatId":"10000000","message":"Привет"}', signal }),
  )
  const notification = await adapter.receiveNotification(signal)
  expect(notification).toMatchObject({ receiptId: '7', chat, message: {
    id: 'incoming-1', chatId: chat.id, text: '<b>ответ</b>', direction: 'incoming',
  } })
  expect(await adapter.receiveNotification(signal)).toEqual(notification)
  await adapter.acknowledgeNotification('7', signal)
  expect(await adapter.getMessages(chat.id, signal)).toEqual([notification?.message, sent])
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/waInstance123/deleteNotification/synthetic-token/7',
    expect.objectContaining({ method: 'DELETE', signal }),
  )
})

it('объясняет недоступность поиска без создания чата', async () => {
  stubHistoryFetch(vi.fn().mockResolvedValue(Response.json({ exist: false, chatId: '' })))
  const adapter = createTelegramAdapter(credentials)
  const signal = new AbortController().signal
  await expect(adapter.resolveRecipient('+79991234567', signal)).rejects.toMatchObject({
    code: 'telegram-recipient-unavailable',
    message: 'Аккаунт Telegram по этому номеру не найден или скрыт настройками приватности.',
  })
  expect(await adapter.getChats(signal)).toEqual([])
})

it('отмечает открытый чат прочитанным и обновляет подтверждённый статус исходящего', async () => {
  const status = (receiptId: number, value: string) => ({ receiptId, body: {
    typeWebhook: 'outgoingMessageStatus', idMessage: 'outgoing-1', chatId: '10000000', status: value,
  } })
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ exist: true, chatId: '10000000' }))
    .mockResolvedValueOnce(Response.json({ idMessage: 'outgoing-1' }))
    .mockResolvedValueOnce(Response.json({ setRead: true }))
    .mockResolvedValueOnce(Response.json(status(1, 'delivered')))
    .mockResolvedValueOnce(Response.json(status(2, 'sent')))
    .mockResolvedValueOnce(Response.json(status(3, 'read')))
  stubHistoryFetch(fetchMock)
  const adapter = createTelegramAdapter(credentials)
  const signal = new AbortController().signal
  const chat = await adapter.resolveRecipient('+79991234567', signal)
  await adapter.sendText(chat.id, 'Текст', signal)
  await adapter.readChat(chat.id, signal)
  expect(fetchMock).toHaveBeenNthCalledWith(3,
    'https://api.example.test/waInstance123/readChat/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"chatId":"10000000"}', signal }),
  )
  expect((await adapter.receiveNotification(signal))?.message?.status).toBe('delivered')
  expect((await adapter.receiveNotification(signal))?.message?.status).toBe('delivered')
  expect((await adapter.receiveNotification(signal))?.message?.status).toBe('read')
  expect((await adapter.getMessages(chat.id, signal))[0].status).toBe('read')
})
