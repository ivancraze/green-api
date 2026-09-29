import { ChatPage } from '@/pages/chat'
import { LoginPage } from '@/pages/login'
import { useSession } from '@/shared/session'

import { AppProviders } from '../providers/AppProviders'

function SessionPage() {
  const { session } = useSession()
  return session ? <ChatPage key={session.id} session={session} /> : <LoginPage />
}

export function App() {
  return (
    <AppProviders>
      <SessionPage />
    </AppProviders>
  )
}
