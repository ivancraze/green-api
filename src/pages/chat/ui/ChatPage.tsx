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
        <Flex gap="middle" vertical>
          <Card>
            <Flex
              align="center"
              gap="small"
              justify="space-between"
              wrap
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
            <Col md={8} xs={24}>
              <Flex gap="middle" vertical>
                <CreateChatForm
                  disabled={!chats.isSuccess}
                  onCreated={chat => setSelectedChatId(chat.id)}
                  session={session}
                />
                <Card aria-busy={chats.isPending} loading={chats.isPending} title="Чаты">
                  {
                    chats.isError ? (
                      <Flex gap="small" vertical>
                        <Typography.Paragraph role="alert">
                          {normalizeError(chats.error).message}
                        </Typography.Paragraph>
                        <Button loading={chats.isFetching} onClick={() => { void chats.refetch() }}>
                          Повторить загрузку
                        </Button>
                      </Flex>
                    ) : chats.data?.length ? (
                      <Menu
                        aria-label="Список чатов"
                        items={chats.data.map(chat => ({ key: chat.id, label: chat.title }))}
                        mode="inline"
                        onClick={({ key }) => setSelectedChatId(key)}
                        selectedKeys={selectedChat ? [selectedChat.id] : []}
                      />
                    ) : <Empty description="Чатов пока нет" />
                  }
                </Card>
              </Flex>
            </Col>
            <Col md={16} xs={24}>
              {
                selectedChat ? <Conversation chat={selectedChat} key={selectedChat.id} session={session} /> : (
                  <Card title="Разговор">
                    <Empty description="Выберите чат из списка" />
                  </Card>
                )
              }
            </Col>
          </Row>
        </Flex>
      </Layout.Content>
    </Layout>
  )
}
