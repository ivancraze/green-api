import {
  afterEach,
  expect,
  it,
  vi
} from 'vitest'

import {
  type ConnectionCredentials,
  createMaxAdapter,
  createTelegramAdapter,
  createWhatsappAdapter,
} from '@/shared/api'

afterEach(() => vi.unstubAllGlobals())

it.each([
  { messenger: 'max', id: 'max-user-1', remote: { chatId: 'max-user-1', name: 'Собеседник', type: 'user', phoneNumber: 79991234567 }, create: createMaxAdapter },
  { messenger: 'whatsapp', id: '79991234567@c.us', remote: { id: '79991234567@c.us', name: 'Собеседник', type: 'user' }, create: createWhatsappAdapter },
  { messenger: 'telegram', id: '10000000', remote: { chatId: '10000000', name: 'Собеседник', type: 'user', phoneNumber: 79991234567 }, create: createTelegramAdapter },
] as const)('восстанавливает старый личный чат и историю $messenger для отправки', async ({ messenger, id, remote, create }) => {
  const credentials: ConnectionCredentials = {
    messenger, apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
  }
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/getChats/')) return Promise.resolve(Response.json([remote, { type: 'group', chatId: 'group' }]))
    if (url.includes('/getChatHistory/')) return Promise.resolve(Response.json([
      { idMessage: 'old-2', chatId: id, type: 'outgoing', typeMessage: 'textMessage', textMessage: 'Ответ', timestamp: 200, statusMessage: 'delivered' },
      { idMessage: 'old-1', chatId: id, type: 'incoming', typeMessage: 'textMessage', textMessage: '<b>Привет</b>', timestamp: 100, senderName: 'Собеседник' },
      { idMessage: 'file', chatId: id, type: 'incoming', typeMessage: 'imageMessage', timestamp: 50 },
    ]))
    if (url.includes('/sendMessage/')) return Promise.resolve(Response.json({ idMessage: 'new-1' }))
    throw new Error('Unexpected request')
  })
  vi.stubGlobal('fetch', fetchMock)
  const adapter = create(credentials)
  const signal = new AbortController().signal

  expect(await adapter.getChats(signal)).toEqual([{ id, title: 'Собеседник', phone: '+79991234567' }])
  expect(await adapter.getMessages(id, signal)).toMatchObject([
    { id: 'old-1', direction: 'incoming', text: '<b>Привет</b>', timestamp: 100000 },
    { id: 'old-2', direction: 'outgoing', status: 'delivered', timestamp: 200000 },
  ])
  await adapter.sendText(id, 'Новое сообщение', signal)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/waInstance123/sendMessage/synthetic-token',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ chatId: id, message: 'Новое сообщение' }) }),
  )
})

it('восстанавливает WhatsApp-диалоги из журналов, когда GetChats вернул пустой список', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/getChats/')) return Promise.resolve(Response.json([]))
    if (url.includes('/lastIncomingMessages/')) return Promise.resolve(Response.json([
      { chatId: '79991234567@c.us', senderContactName: 'Старый чат', timestamp: 200 },
      { chatId: '123@g.us', senderContactName: 'Группа', timestamp: 300 },
    ]))
    if (url.includes('/lastOutgoingMessages/')) return Promise.resolve(Response.json([
      { chatId: '79991234567@c.us', timestamp: 100 },
      { chatId: '78885554433@c.us', timestamp: 50 },
    ]))
    if (url.includes('/sendMessage/')) return Promise.resolve(Response.json({ idMessage: 'new-1' }))
    throw new Error('Unexpected request')
  })
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createWhatsappAdapter({
    messenger: 'whatsapp', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
  })
  const signal = new AbortController().signal

  expect(await adapter.getChats(signal)).toEqual([
    { id: '79991234567@c.us', title: 'Старый чат', phone: '+79991234567' },
    { id: '78885554433@c.us', title: '+78885554433', phone: '+78885554433' },
  ])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/waInstance123/lastIncomingMessages/synthetic-token?minutes=20160',
    expect.objectContaining({ method: 'GET', signal }),
  )
  await adapter.sendText('79991234567@c.us', 'Продолжить', signal)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/waInstance123/sendMessage/synthetic-token',
    expect.objectContaining({ body: '{"chatId":"79991234567@c.us","message":"Продолжить"}' }),
  )
})

it('берёт имя Telegram-собеседника из входящего журнала, даже если исходящее сообщение новее', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/getChats/')) return Promise.resolve(Response.json([]))
    if (url.includes('/lastIncomingMessages/')) return Promise.resolve(Response.json([
      { chatId: '10000000', chatType: 'user', senderName: 'Ivan P.', senderPhoneNumber: 79991234567, timestamp: 100 },
    ]))
    if (url.includes('/lastOutgoingMessages/')) return Promise.resolve(Response.json([
      { chatId: '10000000', chatType: 'user', timestamp: 200 },
    ]))
    throw new Error('Unexpected request')
  }))
  const adapter = createTelegramAdapter({
    messenger: 'telegram', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
  })

  expect(await adapter.getChats(new AbortController().signal)).toEqual([
    { id: '10000000', title: 'Ivan P.', phone: '+79991234567' },
  ])
})

it('дополняет MAX-историю входящим из журнала, когда GetChatHistory вернул только исходящие', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/getChatHistory/')) return Promise.resolve(Response.json([
      { idMessage: 'out-1', chatId: '10000000', type: 'outgoing', typeMessage: 'textMessage', textMessage: 'Ответ', timestamp: 200 },
    ]))
    if (url.includes('/lastIncomingMessages/')) return Promise.resolve(Response.json([
      { idMessage: 'in-1', chatId: '10000000', chatType: 'user', type: 'incoming', typeMessage: 'textMessage', textMessage: 'Привет', timestamp: 100, senderName: 'Собеседник' },
      { idMessage: 'other', chatId: '20000000', chatType: 'user', type: 'incoming', typeMessage: 'textMessage', textMessage: 'Другое', timestamp: 150 },
    ]))
    throw new Error('Unexpected request')
  })
  vi.stubGlobal('fetch', fetchMock)
  const adapter = createMaxAdapter({
    messenger: 'max', apiUrl: 'https://api.example.test', idInstance: '123', apiTokenInstance: 'synthetic-token',
  })

  expect(await adapter.getMessages('10000000', new AbortController().signal)).toMatchObject([
    { id: 'in-1', direction: 'incoming', text: 'Привет' },
    { id: 'out-1', direction: 'outgoing', text: 'Ответ' },
  ])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/waInstance123/lastIncomingMessages/synthetic-token?minutes=20160',
    expect.objectContaining({ method: 'GET' }),
  )
})
