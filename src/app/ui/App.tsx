import { LoginPage } from '@/pages/login'

import { AppProviders } from '../providers/AppProviders'

export function App() {
  return (
    <AppProviders>
      <LoginPage />
    </AppProviders>
  )
}
