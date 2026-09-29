import { afterEach, expect, it, vi } from 'vitest'

import { checkRealConnection, type ConnectionCredentials } from '@/shared/api'

const credentials: ConnectionCredentials = {
  messenger: 'max', apiUrl: 'https://api.example.test/v3/', idInstance: '123', apiTokenInstance: 'synthetic-token',
}
afterEach(() => vi.unstubAllGlobals())

it('проверяет состояние через GET с AbortSignal и сохраняет apiUrl из кабинета', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ stateInstance: 'authorized' }))
  vi.stubGlobal('fetch', fetchMock)
  const signal = new AbortController().signal
  await checkRealConnection(credentials, signal)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.test/v3/waInstance123/getStateInstance/synthetic-token',
    expect.objectContaining({ signal, credentials: 'omit', cache: 'no-store', redirect: 'error' }),
  )
})

it('отклоняет HTTP, неверный JSON/структуру и неготовый инстанс безопасной ошибкой', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const cases = [
    [new Response('synthetic-token', { status: 403 }), 'unauthorized'],
    [new Response('synthetic-token', { status: 500 }), 'http'],
    [new Response('not-json'), 'invalid-response'],
    [Response.json({ stateInstance: 'synthetic-token' }), 'invalid-response'],
    [Response.json(null), 'invalid-response'],
    [Response.json({ stateInstance: 'notAuthorized' }), 'unauthorized'],
    [Response.json({ stateInstance: 'starting' }), 'instance-unavailable'],
  ] as const
  for (const [response, code] of cases) {
    fetchMock.mockResolvedValueOnce(response)
    const error = await checkRealConnection(credentials, new AbortController().signal).catch(error => error)
    expect(error).toMatchObject({ code })
    expect(JSON.stringify(error) + error.message).not.toContain('synthetic-token')
  }
})

it('отклоняет небезопасный ввод до сети и нормализует сетевой отказ и отмену', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('synthetic-token'))
  vi.stubGlobal('fetch', fetchMock)
  await expect(checkRealConnection({ ...credentials, apiUrl: 'http://api.example.test' }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'invalid-credentials' })
  expect(fetchMock).not.toHaveBeenCalled()
  await expect(checkRealConnection(credentials, new AbortController().signal)).rejects.toMatchObject({ code: 'network' })
  const controller = new AbortController()
  controller.abort()
  await expect(checkRealConnection(credentials, controller.signal)).rejects.toMatchObject({ code: 'cancelled' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
