import { Card, Typography } from 'antd'

import { appName } from '@/shared/config'

export function LoginPage() {
  return (
    <main>
      <Card>
        <Typography.Title level={1}>{appName}</Typography.Title>
        <Typography.Paragraph>
          Чат для личных текстовых сообщений в MAX, WhatsApp и Telegram.
        </Typography.Paragraph>
        <Typography.Paragraph>
          Приложение находится в разработке. Вход в деморежим будет доступен
          после подготовки основы.
        </Typography.Paragraph>
      </Card>
    </main>
  )
}
