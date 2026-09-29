import {LogoutOutlined, PlusOutlined} from "@ant-design/icons";
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Flex,
  Layout,
  Menu,
  Modal,
  Switch,
  Typography,
} from 'antd'
import { useState } from 'react'

import type { DemoFailures } from '@/shared/api'
import { useColorScheme } from '@/shared/config'
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
  const { dark, setDark } = useColorScheme()
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
    retry: (failures, error) => {
      if (!('credentials' in session) || failures >= 2) return false
      const { code, status } = normalizeError(error)
      return code === 'network' || code === 'http' && (status === 429 || status !== undefined && status >= 500)
    },
    retryDelay: 1200,
  })
  const selectedChat = chats.data?.find(chat => chat.id === selectedChatId)

  return (
    <Layout
      className={styles.page}
      role="main"
    >
      <Card className={styles.fixed} size="small">
        <Flex
          align="center"
          gap="small"
          justify="space-between"
          wrap
        >
          <Typography.Text strong>
            {`${'credentials' in session ? 'Реальное подключение' : 'Деморежим'}: ${messengerNames[session.messenger]}`}
          </Typography.Text>
          <Flex gap="small">
            <Flex align="center" gap="small">
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
            {
              session.demo && <Button onClick={() => setFailuresOpen(true)}>
                Демоотказы
              </Button>
            }
            <Button
              aria-label="Выйти"
              danger
              icon={<LogoutOutlined />}
              onClick={() => setSession(null)}
            >
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
            <Button
              aria-label="Новый чат"
              disabled={!chats.isSuccess}
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              shape="circle"
              size="small"
              type="primary"
            />
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
                inlineIndent={8}
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
          <Checkbox
            checked={Boolean(failures.send)}
            onChange={event => changeFailure('send', event.target.checked)}
            styles={{ icon: { borderRadius: 2 } }}
          >
            Отказ отправки
          </Checkbox>
          <Checkbox
            checked={Boolean(failures.receive)}
            onChange={event => changeFailure('receive', event.target.checked)}
            styles={{ icon: { borderRadius: 2 } }}
          >
            Отказ получения
          </Checkbox>
          <Typography.Text type="secondary">
            Выключите отказ: отправку повторите вручную, получение восстановится автоматически с задержкой.
          </Typography.Text>
        </Flex>
      </Modal>
    </Layout>
  )
}
