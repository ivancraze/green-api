import { CancelledError } from '@tanstack/react-query'

import { type AppErrorCode, normalizeError } from '@/shared/errors'

interface ErrorNotice {
  key: string
  content: string
  onClose: () => void
}

export function createErrorReporter(show: (notice: ErrorNotice) => void) {
  const visible = new Set<AppErrorCode>()

  return (error: unknown) => {
    if (error instanceof CancelledError) return

    const normalized = normalizeError(error)
    if (normalized.code === 'cancelled' || visible.has(normalized.code)) return

    visible.add(normalized.code)
    show({
      key: `app-error-${normalized.code}`,
      content: normalized.message,
      onClose: () => visible.delete(normalized.code),
    })
  }
}

// React по умолчанию выводит исходную ошибку и componentStack в консоль.
export function reportRenderError() {
  console.error('Ошибка отображения приложения.')
}
