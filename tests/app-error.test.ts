import { expect, it } from 'vitest'

import { AppError, normalizeError } from '@/shared/errors'

it.each([
  [new TypeError('secret'), 'network'],
  [new SyntaxError('secret'), 'invalid-response'],
  [new DOMException('secret', 'AbortError'), 'cancelled'],
  [new Response('secret', { status: 401 }), 'unauthorized'],
  [new Response('secret', { status: 500 }), 'http'],
  [new Error('secret'), 'unknown'],
])('нормализует %o в %s без исходного текста', (source, code) => {
  const error = normalizeError(source)
  expect(error.code).toBe(code)
  expect(error.message).not.toContain('secret')
})

it('сохраняет нормализованную ошибку', () => {
  const error = new AppError('http', 429)
  expect(normalizeError(error)).toBe(error)
  expect(error.status).toBe(429)
})
