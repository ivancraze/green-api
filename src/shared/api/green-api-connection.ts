import { AppError, normalizeError } from '@/shared/errors'

import type { ConnectionCredentials } from './messenger'

export function normalizeCredentials(credentials: ConnectionCredentials): ConnectionCredentials {
  try {
    const url = new URL(credentials.apiUrl.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error()
    const idInstance = credentials.idInstance.trim()
    const apiTokenInstance = credentials.apiTokenInstance.trim()
    if (!/^\d+$/.test(idInstance) || !/^[\w-]+$/.test(apiTokenInstance)) throw new Error()
    if (!['max', 'whatsapp', 'telegram'].includes(credentials.messenger)) throw new Error()
    return { ...credentials, apiUrl: url.href.replace(/\/+$/, ''), idInstance, apiTokenInstance }
  }
  catch {
    throw new AppError('invalid-credentials')
  }
}

export async function checkRealConnection(credentials: ConnectionCredentials, signal: AbortSignal): Promise<void> {
  const { apiUrl, idInstance, apiTokenInstance, messenger } = normalizeCredentials(credentials)
  try {
    signal.throwIfAborted()
    const response = await fetch(`${apiUrl}/waInstance${idInstance}/getStateInstance/${apiTokenInstance}`, {
      signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw normalizeError(response)
    const body: unknown = await response.json()
    signal.throwIfAborted()
    if (!body || typeof body !== 'object' || !('stateInstance' in body) || typeof body.stateInstance !== 'string') {
      throw new AppError('invalid-response')
    }
    const states = messenger === 'whatsapp'
      ? ['authorized', 'notAuthorized', 'blocked', 'starting', 'suspended', 'sleepMode', 'yellowCard']
      : ['authorized', 'notAuthorized', 'blocked', 'starting', 'suspended', 'pendingPassword']
    if (!states.includes(body.stateInstance)) throw new AppError('invalid-response')
    if (body.stateInstance === 'notAuthorized' || body.stateInstance === 'pendingPassword') throw new AppError('unauthorized')
    if (body.stateInstance !== 'authorized') throw new AppError('instance-unavailable')
  }
  catch (error) {
    throw normalizeError(error)
  }
}
