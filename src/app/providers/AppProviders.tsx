import { App as AntdApp, ConfigProvider, theme } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { type PropsWithChildren, useState } from 'react'

import { ColorSchemeContext } from '@/shared/config'
import { SessionProvider } from '@/shared/session'

import { ErrorBoundary } from './ErrorBoundary'
import { QueryProvider } from './QueryProvider'

export function AppProviders({ children }: PropsWithChildren) {
  const [dark, setDark] = useState(false)

  return (
    <ColorSchemeContext value={{ dark, setDark }}>
      <ConfigProvider
        locale={ruRU}
        theme={
          {
            algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: { colorPrimary: '#087bff', borderRadius: 14 },
          }
        }
      >
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
    </ColorSchemeContext>
  )
}
