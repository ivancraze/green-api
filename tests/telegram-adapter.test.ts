import { afterEach, expect, it, vi } from 'vitest'

import { type ConnectionCredentials, createTelegramAdapter } from '@/shared/api'

const credentials: ConnectionCredentials = {
  messenger: 'telegram', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
}
afterEach(() => vi.unstubAllGlobals())

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
  vi.stubGlobal('fetch', fetchMock)
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
  expect(await adapter.getMessages(chat.id, signal)).toEqual([sent, notification?.message])
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/waInstance123/deleteNotification/synthetic-token/7',
    expect.objectContaining({ method: 'DELETE', signal }),
  )
})

it('объясняет недоступность поиска без создания чата', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ exist: false, chatId: '' })))
  const adapter = createTelegramAdapter(credentials)
  const signal = new AbortController().signal
  await expect(adapter.resolveRecipient('+79991234567', signal)).rejects.toMatchObject({
    code: 'telegram-recipient-unavailable',
    message: 'Аккаунт Telegram по этому номеру не найден или скрыт настройками приватности.',
  })
  expect(await adapter.getChats(signal)).toEqual([])
})
