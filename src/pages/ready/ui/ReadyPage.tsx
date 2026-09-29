import { Button, Card, Typography } from 'antd'

import { appName } from '@/shared/config'
import { useSession } from '@/shared/session'

const messengerNames = { max: 'MAX', whatsapp: 'WhatsApp', telegram: 'Telegram' }

export function ReadyPage() {
  const { session, setSession } = useSession()
  if (!session) return null

  return (
    <main>
      <Card>
        <Typography.Title level={1}>
          {appName}
        </Typography.Title>
        <Typography.Title level={2}>
          Основа готова
        </Typography.Title>
        <Typography.Paragraph>
          {`Деморежим: ${messengerNames[session.messenger]}.`}
        </Typography.Paragraph>
        <Typography.Paragraph>
          Пока чисто моки.
          Сессия хранится только в памяти и сбрасывается при перезагрузке страницы.
        </Typography.Paragraph>
        <Button onClick={() => setSession(null)}>
          Выйти
        </Button>
      </Card>
    </main>
  )
}
