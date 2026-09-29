import { Button, Card, Checkbox, Form, Radio, Typography } from 'antd'
import { useState } from 'react'

import type { Messenger } from '@/shared/api'
import { appName } from '@/shared/config'

import { useDemoLogin } from '../api/use-demo-login'

export function LoginPage({ initialMessenger = 'max' }: { initialMessenger?: Messenger }) {
  const [messenger, setMessenger] = useState<Messenger>(initialMessenger)
  const [connectionFailure, setConnectionFailure] = useState(false)
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
        <Form layout="vertical" onFinish={() => { if (!login.isPending) login.mutate({ messenger, connectionFailure }) }}>
          <Form.Item htmlFor="messenger" label="Мессенджер">
            <Radio.Group
              aria-label="Мессенджер"
              disabled={login.isPending}
              id="messenger"
              name="messenger"
              onChange={event => setMessenger(event.target.value)}
              options={
                [
                  { label: 'MAX', value: 'max' },
                  { label: 'WhatsApp', value: 'whatsapp' },
                  { label: 'Telegram', value: 'telegram' },
                ]
              }
              value={messenger}
            />
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={connectionFailure}
              disabled={login.isPending}
              onChange={event => setConnectionFailure(event.target.checked)}
            >
              Отказ подключения (демо)
            </Checkbox>
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Для проверки ошибки включите отказ. Затем выключите его и повторите вход.
          </Typography.Paragraph>
          <Button
            disabled={login.isPending}
            htmlType="submit"
            loading={login.isPending}
            type="primary"
          >
            Войти в демо
          </Button>
        </Form>
      </Card>
    </main>
  )
}
