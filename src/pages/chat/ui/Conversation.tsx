import { Button, Card, Empty, Flex, Form, Input, Typography } from 'antd'
import { useState } from 'react'

import type { Chat } from '@/shared/api'

export function Conversation({ chat }: { chat: Chat }) {
  const [draft, setDraft] = useState('')

  return (
    <Card
      title={
        <Typography.Title level={2}>
          {chat.title}
        </Typography.Title>
      }
    >
      <Flex gap="middle" vertical>
        <Typography.Text type="secondary">
          {chat.phone}
        </Typography.Text>
        <Empty description="История сообщений пока недоступна." />
        <Form layout="vertical" onFinish={() => {}}>
          <Form.Item
            extra="Отправка сообщений пока недоступна."
            htmlFor="message-draft"
            label="Сообщение"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              id="message-draft"
              onChange={event => setDraft(event.target.value)}
              placeholder="Введите текст сообщения"
              value={draft}
            />
          </Form.Item>
          <Button disabled htmlType="submit" type="primary">
            Отправить
          </Button>
        </Form>
      </Flex>
    </Card>
  )
}
