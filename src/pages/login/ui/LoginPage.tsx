import {
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  Layout,
  Radio,
  Switch,
  Typography
} from 'antd'
import { useState } from 'react'

import type { ConnectionCredentials, Messenger } from '@/shared/api'
import { appName, useColorScheme } from '@/shared/config'

import { useDemoLogin } from '../api/use-demo-login'
import { useRealLogin } from '../api/use-real-login'
import styles from './login-layout.module.css'

export function LoginPage({ initialMessenger = 'max' }: { initialMessenger?: Messenger }) {
  const { dark, setDark } = useColorScheme()
  const [messenger, setMessenger] = useState<Messenger>(initialMessenger)
  const [connectionFailure, setConnectionFailure] = useState(false)
  const login = useDemoLogin()
  const realLogin = useRealLogin()
  const [mode, setMode] = useState<'demo' | 'real'>('demo')
  const isPending = login.isPending || realLogin.isPending

  return (
    <Layout className={styles.page}>
      <main className={styles.container}>
        <Card>
          <Flex align="center" gap="small" justify="space-between">
            <Typography.Title level={2}>
              {appName}
            </Typography.Title>
            <Switch
              aria-label="Тема"
              checked={dark}
              checkedChildren={
                <Flex align="center" gap={4} justify="flex-start">
                  Темная
                </Flex>
              }
              onChange={setDark}
              unCheckedChildren={
                <Flex align="center" gap={4} justify="flex-start">
                  Светлая
                </Flex>
              }
            />
          </Flex>
          <Typography.Paragraph>
            Чат для личных текстовых сообщений в MAX, WhatsApp и Telegram.
          </Typography.Paragraph>
          <Typography.Paragraph>
            Для деморежима данные инстанса не нужны. Для реального подключения возьмите их из кабинета GREEN-API.
          </Typography.Paragraph>
          <Radio.Group
            aria-label="Режим подключения"
            className={styles.mode}
            disabled={isPending}
            onChange={event => setMode(event.target.value)}
            options={[{ label: 'Демо', value: 'demo' }, { label: 'Реальное подключение', value: 'real' }]}
            value={mode}
          />
          <Form
            autoComplete="off"
            clearOnDestroy
            disabled={isPending}
            key={mode}
            layout="vertical"
            onFinish={
              (values: Omit<ConnectionCredentials, 'messenger'>) => {
                if (isPending) return
                if (mode === 'demo') login.mutate({ messenger, connectionFailure })
                else realLogin.connect({ ...values, messenger })
              }
            }
          >
            <Form.Item htmlFor="messenger" label="Мессенджер">
              <Radio.Group
                aria-label="Мессенджер"
                disabled={isPending}
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
            {
              mode === 'demo' ? (
                <>
                  <Form.Item>
                    <Checkbox
                      checked={connectionFailure}
                      disabled={isPending}
                      onChange={event => setConnectionFailure(event.target.checked)}
                      styles={{ icon: { borderRadius: 2 } }}
                    >
                      Отказ подключения (демо) (Для проверки ошибки)
                    </Checkbox>
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item label="apiUrl" name="apiUrl" rules={[{ required: true, whitespace: true, message: 'Введите HTTPS-адрес API из кабинета.' }]}>
                    <Input autoComplete="off" placeholder="https://…" />
                  </Form.Item>
                  <Form.Item label="idInstance" name="idInstance" rules={[{ required: true, pattern: /^\d+$/, message: 'Введите числовой idInstance.' }]}>
                    <Input autoComplete="off" inputMode="numeric" />
                  </Form.Item>
                  <Form.Item label="apiTokenInstance" name="apiTokenInstance" rules={[{ required: true, whitespace: true, message: 'Введите токен инстанса.' }]}>
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Typography.Paragraph type="secondary">
                    Данные хранятся только в памяти и сбрасываются при выходе или перезагрузке.
                    Подключение проверяет авторизацию инстанса.
                  </Typography.Paragraph>
                </>
              )
            }
            <Button
              disabled={isPending}
              htmlType="submit"
              loading={isPending}
              type="primary"
            >
              {mode === 'demo' ? 'Войти в демо' : 'Подключиться'}
            </Button>
          </Form>
        </Card>
      </main>
    </Layout>
  )
}
