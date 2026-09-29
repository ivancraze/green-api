import { normalizeError } from '@/shared/errors'

import type { ConnectionCredentials } from './messenger'

export function createGreenApiTransport({ apiUrl, idInstance, apiTokenInstance }: ConnectionCredentials) {
  const base = `${apiUrl}/waInstance${idInstance}`

  async function request(method: 'GET' | 'DELETE' | 'POST', path: string, signal: AbortSignal, body?: object): Promise<unknown> {
    try {
      signal.throwIfAborted()
      const response = await fetch(`${base}/${path}`, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      })
      if (!response.ok) throw normalizeError(response)
      const content = await response.text()
      const result: unknown = method === 'GET' && !content.trim() ? null : JSON.parse(content)
      signal.throwIfAborted()
      return result
    }
    catch (error) {
      throw normalizeError(error)
    }
  }

  return {
    get: (method: string, signal: AbortSignal, minutes?: number) => request(
      'GET', `${method}/${apiTokenInstance}${minutes === undefined ? '' : `?minutes=${minutes}`}`, signal,
    ),
    post: (method: string, body: object, signal: AbortSignal) => request('POST', `${method}/${apiTokenInstance}`, signal, body),
    receive: (signal: AbortSignal) => request('GET', `receiveNotification/${apiTokenInstance}`, signal),
    acknowledge: (receiptId: string, signal: AbortSignal) => request('DELETE', `deleteNotification/${apiTokenInstance}/${receiptId}`, signal),
  }
}
