import { LoginPage } from '@/pages/login'
import { ReadyPage } from '@/pages/ready'
import { useSession } from '@/shared/session'

import { AppProviders } from '../providers/AppProviders'

function SessionPage() {
  const { session } = useSession()
  return session ? <ReadyPage /> : <LoginPage />
}

export function App() {
  return (
    <AppProviders>
      <SessionPage />
    </AppProviders>
  )
}
