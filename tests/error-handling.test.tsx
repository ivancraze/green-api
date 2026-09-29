import { CancelledError } from '@tanstack/react-query'
import type {} from '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { createErrorReporter } from '@/app/lib/error-notifications'
import { createQueryClient } from '@/app/lib/query-client'
import { ErrorBoundary } from '@/app/providers/ErrorBoundary'

it('пропускает отмены и повторы до закрытия уведомления', () => {
  const show = vi.fn()
  const report = createErrorReporter(show)
  report(new CancelledError())
  report(new DOMException('', 'AbortError'))
  expect(show).not.toHaveBeenCalled()

  report(new Error())
  report(new Error())
  expect(show).toHaveBeenCalledTimes(1)
  show.mock.calls[0][0].onClose()
  report(new Error())
  expect(show).toHaveBeenCalledTimes(2)
})

it('показывает общие ошибки и пропускает локально обработанные', async () => {
  const report = vi.fn()
  const local = vi.fn()
  const client = createQueryClient(report)
  const error = new Error()
  const fail = async () => { throw error }

  await expect(client.fetchQuery({ queryKey: ['global'], queryFn: fail, retry: false })).rejects.toBe(error)
  await expect(client.getMutationCache().build(client, { mutationFn: fail }).execute(undefined)).rejects.toBe(error)
  expect(report).toHaveBeenCalledTimes(2)

  await expect(client.fetchQuery({
    queryKey: ['local'], queryFn: fail, retry: false,
    meta: { errorHandling: 'local' },
  })).rejects.toBe(error)
  await expect(client.getMutationCache().build(client, {
    mutationFn: fail, onError: local,
  }).execute(undefined)).rejects.toBe(error)
  expect(local).toHaveBeenCalledOnce()
  expect(report).toHaveBeenCalledTimes(2)
  client.clear()
})

it('показывает безопасный экран при ошибке рендера', () => {
  function Broken(): never { throw new Error('secret') }
  render(<ErrorBoundary>
    <Broken />
  </ErrorBoundary>, { onCaughtError: vi.fn() })
  expect(screen.getByText('Не удалось отобразить приложение')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Перезагрузить страницу' })).toBeVisible()
  expect(document.body.textContent).not.toContain('secret')
})
