import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { type PropsWithChildren, useState } from 'react'

import { SessionProvider } from '@/shared/session'

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ConfigProvider locale={ruRU}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            {children}
          </SessionProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}
