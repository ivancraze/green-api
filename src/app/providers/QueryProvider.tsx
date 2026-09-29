import { QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import { type PropsWithChildren, useState } from 'react'

import { createErrorReporter } from '../lib/error-notifications'
import { createQueryClient } from '../lib/query-client'

export function QueryProvider({ children }: PropsWithChildren) {
  const { message } = App.useApp()
  const [queryClient] = useState(() => createQueryClient(
    createErrorReporter((notice) => { void message.error(notice) }),
  ))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
