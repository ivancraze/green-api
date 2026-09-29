import { Button, Card, Empty, Flex, Form, Input, Typography } from 'antd'
import { useState } from 'react'

import type { Chat } from '@/shared/api'

export function Conversation({ chat }: { chat: Chat }) {
  const [draft, setDraft] = useState('')

  return (
    <Card
      title={<Typography.Title level={2}>
        {chat.title}
      </Typography.Title>}
    >
      <Flex vertical gap="middle">
        <Typography.Text type="secondary">
          {chat.phone}
        </Typography.Text>
        <Empty description="История сообщений пока недоступна." />
        <Form layout="vertical" onFinish={() => {}}>
          <Form.Item
            label="Сообщение"
            htmlFor="message-draft"
            extra="Отправка сообщений пока недоступна."
          >
            <Input.TextArea
              id="message-draft"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="Введите текст сообщения"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" disabled>
            Отправить
          </Button>
        </Form>
      </Flex>
    </Card>
  )
}
