import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Empty, Flex, Layout, Menu, Row, Typography } from 'antd'
import { useState } from 'react'

import { appName } from '@/shared/config'
import { normalizeError } from '@/shared/errors'
import { type Session, useSession } from '@/shared/session'

import { chatQueryKey } from '../api/chat-query-key'
import { Conversation } from './Conversation'
import { CreateChatForm } from './CreateChatForm'

const messengerNames = { max: 'MAX', whatsapp: 'WhatsApp', telegram: 'Telegram' }

export function ChatPage({ session }: { session: Session }) {
  const { setSession } = useSession()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const chats = useQuery({
    queryKey: chatQueryKey(session),
    queryFn: ({ signal }) => session.adapter.getChats(signal),
    meta: { errorHandling: 'local' },
    retry: false,
  })
  const selectedChat = chats.data?.find(chat => chat.id === selectedChatId)

  return (
    <Layout>
      <Layout.Content>
        <Flex vertical gap="middle">
          <Card>
            <Flex
              justify="space-between"
              align="center"
              wrap
              gap="small"
            >
              <div>
                <Typography.Title level={1}>
                  {appName}
                </Typography.Title>
                <Typography.Text>
                  {`Деморежим: ${messengerNames[session.messenger]}`}
                </Typography.Text>
              </div>
              <Button onClick={() => setSession(null)}>
                Выйти
              </Button>
            </Flex>
          </Card>
          <Row gutter={[0, 16]}>
            <Col xs={24} md={8}>
              <Flex vertical gap="middle">
                <CreateChatForm
                  session={session}
                  disabled={!chats.isSuccess}
                  onCreated={chat => setSelectedChatId(chat.id)}
                />
                <Card title="Чаты" loading={chats.isPending} aria-busy={chats.isPending}>
                  {chats.isError ? (
                    <Flex vertical gap="small">
                      <Typography.Paragraph role="alert">
                        {normalizeError(chats.error).message}
                      </Typography.Paragraph>
                      <Button onClick={() => { void chats.refetch() }} loading={chats.isFetching}>
                        Повторить загрузку
                      </Button>
                    </Flex>
                  ) : chats.data?.length ? (
                    <Menu
                      aria-label="Список чатов"
                      mode="inline"
                      selectedKeys={selectedChat ? [selectedChat.id] : []}
                      onClick={({ key }) => setSelectedChatId(key)}
                      items={chats.data.map(chat => ({ key: chat.id, label: chat.title }))}
                    />
                  ) : <Empty description="Чатов пока нет" />}
                </Card>
              </Flex>
            </Col>
            <Col xs={24} md={16}>
              {selectedChat ? <Conversation key={selectedChat.id} chat={selectedChat} /> : (
                <Card title="Разговор">
                  <Empty description="Выберите чат из списка" />
                </Card>
              )}
            </Col>
          </Row>
        </Flex>
      </Layout.Content>
    </Layout>
  )
}
