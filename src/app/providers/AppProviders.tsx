import { App as AntdApp, ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { type PropsWithChildren } from 'react'

import { SessionProvider } from '@/shared/session'

import { ErrorBoundary } from './ErrorBoundary'
import { QueryProvider } from './QueryProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider locale={ruRU}>
      <AntdApp>
        <ErrorBoundary>
          <QueryProvider>
            <SessionProvider>
              {children}
            </SessionProvider>
          </QueryProvider>
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  )
}
