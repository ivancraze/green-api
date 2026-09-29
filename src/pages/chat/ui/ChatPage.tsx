import { useQuery } from '@tanstack/react-query'
import { Button, Card, Checkbox, Empty, Flex, Menu, Modal, Typography } from 'antd'
import { useState } from 'react'

import type { DemoFailures } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import { type ChatSession, useSession } from '@/shared/session'

import { chatQueryKey } from '../api/chat-query-key'
import { useNotifications } from '../api/use-notifications'
import styles from './chat-layout.module.css'
import { ChatPreview } from './ChatPreview'
import { Conversation } from './Conversation'
import { CreateChatForm } from './CreateChatForm'

const messengerNames = { max: 'MAX', whatsapp: 'WhatsApp', telegram: 'Telegram' }

export function ChatPage({ session }: { session: ChatSession }) {
  const { setSession } = useSession()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [failuresOpen, setFailuresOpen] = useState(false)
  const [failures, setFailures] = useState<DemoFailures>({})
  const changeFailure = (failure: 'send' | 'receive', checked: boolean) => {
    const next = { ...failures, [failure]: checked }
    session.demo?.setFailures(next)
    setFailures(next)
  }
  const notifications = useNotifications(session)
  const chats = useQuery({
    queryKey: chatQueryKey(session),
    queryFn: ({ signal }) => session.adapter.getChats(signal),
    meta: { errorHandling: 'local' },
    retry: false,
  })
  const selectedChat = chats.data?.find(chat => chat.id === selectedChatId)

  return (
    <Flex
      className={styles.page}
      component="main"
      gap="small"
      vertical
    >
      <Card className={styles.fixed} size="small">
        <Flex
          align="center"
          gap="small"
          justify="space-between"
          wrap
        >
          <Typography.Text strong>
            {`Деморежим: ${messengerNames[session.messenger]}`}
          </Typography.Text>
          <Flex gap="small">
            {
              session.demo && <Button onClick={() => setFailuresOpen(true)}>
                Демоотказы
              </Button>
            }
            <Button onClick={() => setSession(null)}>
              Выйти
            </Button>
          </Flex>
        </Flex>
        {
          notifications.isError && (
            <Typography.Paragraph role="alert">
              {normalizeError(notifications.error).message}
            </Typography.Paragraph>
          )
        }
      </Card>
      <Flex className={`${styles.panels} ${selectedChat ? styles.chatSelected : ''}`} gap="small">
        <Card
          aria-busy={chats.isPending}
          className={styles.sidebar}
          classNames={{ body: styles.sidebarBody }}
          extra={
            <Button aria-label="Новый чат" disabled={!chats.isSuccess} onClick={() => setCreateOpen(true)}>
              +
            </Button>
          }
          loading={chats.isPending}
          size="small"
          title={
            <Flex align="center" className={styles.panelTitle}>
              Чаты
            </Flex>
          }
        >
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
                className={styles.chatMenu}
                items={
                  chats.data.map(chat => ({
                    key: chat.id,
                    'aria-label': chat.title,
                    className: styles.chatItem,
                    label: <ChatPreview chat={chat} session={session} />,
                  }))
                }
                mode="inline"
                onClick={({ key }) => setSelectedChatId(key)}
                selectedKeys={selectedChat ? [selectedChat.id] : []}
              />
            ) : <Empty description="Чатов пока нет" />
          }
        </Card>
        <Flex className={styles.conversationPane}>
          {
            selectedChat ? (
              <Conversation
                chat={selectedChat}
                draft={drafts[selectedChat.id] ?? ''}
                key={selectedChat.id}
                onBack={() => setSelectedChatId(null)}
                onDraftChange={draft => setDrafts(current => ({ ...current, [selectedChat.id]: draft }))}
                sendingEnabled={!createOpen && !failuresOpen}
                session={session}
              />
            ) : (
              <Card className={styles.conversation} classNames={{ body: styles.emptyState }}>
                <Empty description="Выберите чат из списка" />
              </Card>
            )
          }
        </Flex>
      </Flex>
      <CreateChatForm
        disabled={!chats.isSuccess}
        onClose={() => setCreateOpen(false)}
        onCreated={chat => { setSelectedChatId(chat.id); setCreateOpen(false) }}
        open={createOpen}
        session={session}
      />
      <Modal
        footer={null}
        onCancel={() => setFailuresOpen(false)}
        open={failuresOpen}
        title="Демоотказы"
      >
        <Flex gap="small" vertical>
          <Checkbox checked={Boolean(failures.send)} onChange={event => changeFailure('send', event.target.checked)}>
            Отказ отправки
          </Checkbox>
          <Checkbox checked={Boolean(failures.receive)} onChange={event => changeFailure('receive', event.target.checked)}>
            Отказ получения
          </Checkbox>
          <Typography.Text type="secondary">
            Выключите отказ: отправку повторите вручную, получение восстановится автоматически с задержкой.
          </Typography.Text>
        </Flex>
      </Modal>
    </Flex>
  )
}
