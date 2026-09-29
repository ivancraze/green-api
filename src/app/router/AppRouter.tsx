import { Result } from 'antd'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from 'react-router'

import { ChatPage } from '@/pages/chat'
import { LoginPage } from '@/pages/login'
import { ReadyPage } from '@/pages/ready'
import type { Messenger } from '@/shared/api'
import { loginPath, messengerPaths } from '@/shared/config'
import { useSession } from '@/shared/session'

function LoginRoute() {
  const { session } = useSession()
  const { state } = useLocation()
  const requestedMessenger = state?.messenger
  const initialMessenger: Messenger = requestedMessenger === 'whatsapp' || requestedMessenger === 'telegram'
    ? requestedMessenger
    : 'max'

  if (session) return <Navigate replace to={messengerPaths[session.messenger]} />

  return <LoginPage initialMessenger={initialMessenger} key={initialMessenger} />
}

function ChatRoute({ messenger }: { messenger: Messenger }) {
  const { session } = useSession()

  if (!session) return <Navigate replace state={{ messenger }} to={loginPath} />
  if (session.messenger !== messenger) return <Navigate replace to={messengerPaths[session.messenger]} />

  if (!('adapter' in session)) return <ReadyPage />

  return <ChatPage key={session.id} session={session} />
}

function SessionRedirect() {
  const { session } = useSession()
  return <Navigate replace to={session ? messengerPaths[session.messenger] : loginPath} />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <SessionRedirect />
          }
          path="/"
        />
        <Route
          element={
            <LoginRoute />
          }
          path={loginPath}
        />
        <Route
          element={
            <ChatRoute messenger="max" />
          }
          path={messengerPaths.max}
        />
        <Route
          element={
            <ChatRoute messenger="whatsapp" />
          }
          path={messengerPaths.whatsapp}
        />
        <Route
          element={
            <ChatRoute messenger="telegram" />
          }
          path={messengerPaths.telegram}
        />
        <Route
          element={
            <Result status="404" title="Не найдено" />
          }
          path="*"
        />
      </Routes>
    </BrowserRouter>
  )
}
