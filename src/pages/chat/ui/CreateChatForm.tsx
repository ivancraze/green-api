import { Button, Card, Form, Input } from 'antd'

import type { Chat } from '@/shared/api'
import type { Session } from '@/shared/session'

import { useCreateChat } from '../api/use-create-chat'
import { normalizePhone } from '../model/phone'

export function CreateChatForm({ session, disabled, onCreated }: {
  session: Session
  disabled: boolean
  onCreated: (chat: Chat) => void
}) {
  const [form] = Form.useForm<{ phone: string }>()
  const creation = useCreateChat(session, (chat) => {
    form.resetFields()
    onCreated(chat)
  })

  return (
    <Card title="Новый чат">
      <Form
        disabled={disabled || creation.isPending}
        form={form}
        layout="vertical"
        name="create-chat"
        onFinish={
          ({ phone }) => {
            const normalized = normalizePhone(phone)
            if (normalized && !disabled && !creation.isPending) creation.mutate(normalized)
          }
        }
      >
        <Form.Item
          extra="Международный номер с + и кодом страны. Пробелы, скобки и дефисы допустимы."
          label="Телефон"
          name="phone"
          rules={
            [{
              validator: (_, value: unknown) => (
                typeof value === 'string' && normalizePhone(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('Введите международный номер: + и от 8 до 15 цифр, код страны не начинается с 0.'))
              ),
            }]
          }
        >
          <Input autoComplete="tel" placeholder="+7 900 123-45-67" type="tel" />
        </Form.Item>
        <Button
          disabled={disabled || creation.isPending}
          htmlType="submit"
          loading={creation.isPending}
          type="primary"
        >
          Создать чат
        </Button>
      </Form>
    </Card>
  )
}
