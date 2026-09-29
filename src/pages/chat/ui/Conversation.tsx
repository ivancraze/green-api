import { useQuery } from '@tanstack/react-query'
import { Button, Card, Empty, Flex, Form, Input, Typography } from 'antd'
import { useState } from 'react'

import type { Chat } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import type { Session } from '@/shared/session'

export function Conversation({ chat, session }: { chat: Chat, session: Session }) {
  const [draft, setDraft] = useState('')
  const messages = useQuery({
    queryKey: ['session', session.id, session.messenger, 'messages', chat.id],
    queryFn: ({ signal }) => session.adapter.getMessages(chat.id, signal),
    meta: { errorHandling: 'local' },
    retry: false,
  })

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
        <Card
          aria-busy={messages.isPending}
          aria-label="История сообщений"
          loading={messages.isPending}
          role="region"
          title="История сообщений"
        >
          {
            messages.isError ? (
              <Flex gap="small" vertical>
                <Typography.Paragraph role="alert">
                  {normalizeError(messages.error).message}
                </Typography.Paragraph>
                <Button loading={messages.isFetching} onClick={() => { void messages.refetch() }}>
                  Повторить загрузку
                </Button>
              </Flex>
            ) : messages.data?.length ? (
              <Flex gap="small" vertical>
                {
                  messages.data.map(message => (
                    <Card key={message.id} size="small">
                      <Flex gap="small" wrap>
                        <Typography.Text strong>
                          {message.author}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {message.direction === 'incoming' ? 'Входящее' : 'Исходящее'}
                        </Typography.Text>
                        <time dateTime={new Date(message.timestamp).toISOString()}>
                          {new Date(message.timestamp).toLocaleString('ru-RU')}
                        </time>
                      </Flex>
                      <Typography.Paragraph>
                        {message.text}
                      </Typography.Paragraph>
                    </Card>
                  ))
                }
              </Flex>
            ) : <Empty description="Сообщений пока нет" />
          }
        </Card>
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
