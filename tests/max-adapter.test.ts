import { afterEach, expect, it, vi } from 'vitest'

import { type ConnectionCredentials, createMaxAdapter } from '@/shared/api'

const credentials: ConnectionCredentials = {
  messenger: 'max', apiUrl: 'https://api.example.test/v3', idInstance: '123', apiTokenInstance: 'synthetic-token',
}
afterEach(() => vi.unstubAllGlobals())

it('разрешает MAX-номер через CheckAccount и показывает отправку только после принятия SendMessage', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ exist: true, chatId: 'max-user-42', fromCache: false }))
    .mockResolvedValueOnce(Response.json({ idMessage: 'message-77' }))
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createMaxAdapter(credentials)
  const signal = new AbortController().signal
  expect(await adapter.getChats(signal)).toEqual([])
  const chat = await adapter.resolveRecipient('+79991234567', signal)
  expect(chat).toEqual({ id: 'max-user-42', title: '+79991234567', phone: '+79991234567' })
  expect(await adapter.resolveRecipient('+79991234567', signal)).toEqual(chat)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/v3/waInstance123/checkAccount/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"phoneNumber":79991234567}', signal, credentials: 'omit' }),
  )
  const message = await adapter.sendText(chat.id, 'Привет MAX', signal)
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/v3/waInstance123/sendMessage/synthetic-token',
    expect.objectContaining({ method: 'POST', body: '{"chatId":"max-user-42","message":"Привет MAX"}', signal }),
  )
  expect(message).toMatchObject({ id: 'message-77', chatId: chat.id, direction: 'outgoing', text: 'Привет MAX' })
  expect(await adapter.getChats(signal)).toEqual([chat])
  expect(await adapter.getMessages(chat.id, signal)).toEqual([message])
})

it('не создаёт чат без получателя и не добавляет сообщение при неверном ответе API', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ exist: false, chatId: '' }))
    .mockResolvedValueOnce(Response.json({ exist: true, chatId: '42' }))
    .mockResolvedValueOnce(Response.json({ idMessage: '' }))
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createMaxAdapter(credentials)
  const signal = new AbortController().signal
  await expect(adapter.resolveRecipient('+12025550123', signal)).rejects.toMatchObject({ code: 'invalid-max-phone' })
  await expect(adapter.resolveRecipient('+79991234567', signal)).rejects.toMatchObject({ code: 'recipient-unavailable' })
  expect(await adapter.getChats(signal)).toEqual([])
  const chat = await adapter.resolveRecipient('+79991234567', signal)
  await expect(adapter.sendText(chat.id, 'Текст', signal)).rejects.toMatchObject({ code: 'invalid-response' })
  expect(await adapter.getMessages(chat.id, signal)).toEqual([])
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('получает личный текст MAX, не дублирует повтор и подтверждает уведомление только при успешном DELETE', async () => {
  const incoming = {
    receiptId: 42,
    body: {
      typeWebhook: 'incomingMessageReceived', idMessage: 'message-1', timestamp: 1763115112,
      senderData: { chatId: 'user-1', chatType: 'user', senderName: 'Собеседник', senderPhoneNumber: 79991234567 },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '<b>текст</b>' } },
    },
  }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json(null))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json(incoming))
    .mockResolvedValueOnce(Response.json({ result: false }))
    .mockResolvedValueOnce(Response.json({ result: true }))
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createMaxAdapter(credentials)
  const signal = new AbortController().signal
  expect(await adapter.receiveNotification(signal)).toBeNull()
  const notification = await adapter.receiveNotification(signal)
  expect(notification).toMatchObject({ receiptId: '42', chat: { id: 'user-1' }, message: {
    id: 'message-1', chatId: 'user-1', direction: 'incoming', text: '<b>текст</b>', timestamp: 1763115112000,
  } })
  expect(await adapter.receiveNotification(signal)).toEqual(notification)
  expect(await adapter.getChats(signal)).toHaveLength(1)
  expect(await adapter.getMessages('user-1', signal)).toHaveLength(1)
  await expect(adapter.acknowledgeNotification('42', signal)).rejects.toMatchObject({ code: 'invalid-response' })
  await adapter.acknowledgeNotification('42', signal)
  expect(fetchMock).toHaveBeenNthCalledWith(2,
    'https://api.example.test/v3/waInstance123/receiveNotification/synthetic-token',
    expect.objectContaining({ method: 'GET', signal, credentials: 'omit' }),
  )
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/v3/waInstance123/deleteNotification/synthetic-token/42',
    expect.objectContaining({ method: 'DELETE', signal, credentials: 'omit' }),
  )
})

it('подтверждает известное неподдерживаемое событие и отвергает некорректный ответ', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ receiptId: 7, body: { typeWebhook: 'outgoingMessageStatus' } }))
    .mockResolvedValueOnce(Response.json({ receiptId: 8, body: { typeWebhook: 'incomingMessageReceived' } }))
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createMaxAdapter(credentials)
  const signal = new AbortController().signal
  expect(await adapter.receiveNotification(signal)).toEqual({ receiptId: '7', message: null })
  await expect(adapter.receiveNotification(signal)).rejects.toMatchObject({ code: 'invalid-response' })
})
