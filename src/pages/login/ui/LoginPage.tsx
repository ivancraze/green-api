import { Button, Card, Form, Radio, Typography } from 'antd'
import { useState } from 'react'

import type { Messenger } from '@/shared/api'
import { appName } from '@/shared/config'

import { useDemoLogin } from '../api/use-demo-login'

export function LoginPage() {
  const [messenger, setMessenger] = useState<Messenger>('max')
  const login = useDemoLogin()

  return (
    <main>
      <Card>
        <Typography.Title level={1}>
          {appName}
        </Typography.Title>
        <Typography.Paragraph>
          Чат для личных текстовых сообщений в MAX, WhatsApp и Telegram.
        </Typography.Paragraph>
        <Typography.Paragraph>
          Выберите мессенджер для деморежима. Данные инстанса и токен не нужны.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={() => { if (!login.isPending) login.mutate(messenger) }}>
          <Form.Item label="Мессенджер" htmlFor="messenger">
            <Radio.Group
              id="messenger"
              aria-label="Мессенджер"
              name="messenger"
              value={messenger}
              onChange={event => setMessenger(event.target.value)}
              disabled={login.isPending}
              options={[
                { label: 'MAX', value: 'max' },
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Telegram', value: 'telegram' },
              ]}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={login.isPending}
            disabled={login.isPending}
          >
            Войти в демо
          </Button>
        </Form>
      </Card>
    </main>
  )
}
