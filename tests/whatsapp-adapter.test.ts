import {
  afterEach,
  expect,
  it,
  vi
} from 'vitest'

import { type ConnectionCredentials, createWhatsappAdapter } from '@/shared/api'

const credentials: ConnectionCredentials = {
  messenger: 'whatsapp', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
}
afterEach(() => vi.unstubAllGlobals())

function stubHistoryFetch(fetchMock: (url: string, init: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    if (/\/(getChats|getChatHistory|lastIncomingMessages|lastOutgoingMessages)\//.test(url)) return Promise.resolve(Response.json([]))
    return fetchMock(url, init)
  })
}

it('использует возвращённый WhatsApp chatId при отправке и принимает личный текст без дубля', async () => {
  const incoming = {
    receiptId: 42,
    body: {
      typeWebhook: 'incomingMessageReceived', idMessage: 'incoming-1', timestamp: 1763115112,
      senderData: { chatId: '888@lid', sender: '888@lid', senderName: 'Собеседник' },
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: '<b>ответ</b>' } },
    },
  }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ existsWhatsapp: true, chatId: '777@lid' }))
    .mockResolvedValueOnce(Response.json({ idMessage: 'outgoing-1' }))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json({ existsWhatsapp: true, chatId: '888@lid', phoneNumber: '[79991234567@c.us]' }))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json({ result: true }))
  stubHistoryFetch(fetchMock)
  const adapter = createWhatsappAdapter(credentials)
  const signal = new AbortController().signal
  const chat = await adapter.resolveRecipient('+79991234567', signal)
  expect(chat).toEqual({ id: '777@lid', title: '+79991234567', phone: '+79991234567' })
  expect(fetchMock).toHaveBeenNthCalledWith(1,
    'https://api.example.test/waInstance123/checkWhatsapp/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"phoneNumber":79991234567}', signal }),
  )
  await adapter.resolveRecipient('+79991234567', signal)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const sent = await adapter.sendText(chat.id, 'Привет', signal)
  expect(fetchMock).toHaveBeenNthCalledWith(2,
    'https://api.example.test/waInstance123/sendMessage/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"chatId":"777@lid","message":"Привет"}', signal }),
  )
  const notification = await adapter.receiveNotification(signal)
  expect(notification).toMatchObject({ receiptId: '42', chat, message: {
    id: 'incoming-1', chatId: chat.id, text: '<b>ответ</b>', direction: 'incoming', timestamp: 1763115112000,
  } })
  expect(fetchMock).toHaveBeenNthCalledWith(4,
    'https://api.example.test/waInstance123/checkWhatsapp/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"chatId":"888@lid"}', signal }),
  )
  expect(await adapter.receiveNotification(signal)).toEqual(notification)
  await adapter.acknowledgeNotification('42', signal)
  expect(await adapter.getChats(signal)).toEqual([chat])
  expect(await adapter.getMessages(chat.id, signal)).toEqual([notification?.message, sent])
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/waInstance123/deleteNotification/synthetic-token/42',
    expect.objectContaining({ method: 'DELETE', signal }),
  )
})

it('пропускает группы и известные события, но отвергает некорректный текст', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(''))
    .mockResolvedValueOnce(Response.json({ receiptId: 1, body: {
      typeWebhook: 'outgoingMessageStatus', idMessage: 'unknown', chatId: '123@c.us', status: 'delivered',
    } }))
    .mockResolvedValueOnce(Response.json({ receiptId: 2, body: {
      typeWebhook: 'incomingMessageReceived', senderData: { chatId: '123@g.us' },
      messageData: { typeMessage: 'textMessage' },
    } }))
    .mockResolvedValueOnce(Response.json({ receiptId: 3, body: {
      typeWebhook: 'incomingMessageReceived', idMessage: '3', timestamp: 123,
      senderData: { chatId: '123@c.us' }, messageData: { typeMessage: 'textMessage' },
    } }))
  stubHistoryFetch(fetchMock)
  const adapter = createWhatsappAdapter(credentials)
  const signal = new AbortController().signal
  expect(await adapter.receiveNotification(signal)).toBeNull()
  expect(await adapter.receiveNotification(signal)).toEqual({ receiptId: '1', message: null })
  expect(await adapter.receiveNotification(signal)).toEqual({ receiptId: '2', message: null })
  await expect(adapter.receiveNotification(signal)).rejects.toMatchObject({ code: 'invalid-response' })
})
