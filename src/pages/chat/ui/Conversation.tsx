import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  theme,
  Typography
} from 'antd'
import { useEffect, useRef, useState } from 'react'

import type { Chat, Message } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import type { ChatSession } from '@/shared/session'

import { messageQueryKey } from '../api/chat-query-key'
import { useSendText } from '../api/use-send-text'
import styles from './chat-layout.module.css'

function messageStatus(message: Message, real: boolean): string {
  if (message.direction === 'incoming') return 'Входящее'
  if (!real) return 'Исходящее'
  switch (message.status) {
    case 'read': return 'Прочитано'
    case 'delivered': return 'Доставлено'
    case 'failed': return 'Не отправлено'
    case 'sent': return 'Отправлено · доставка не подтверждена'
    default: return 'Принято API · доставка не подтверждена'
  }
}

export function Conversation({ chat, session, draft, onDraftChange, onBack, sendingEnabled }: {
  chat: Chat
  session: ChatSession
  draft: string
  onDraftChange: (draft: string) => void
  onBack: () => void
  sendingEnabled: boolean
}) {
  const { token } = theme.useToken()
  const messages = useQuery({
    queryKey: messageQueryKey(session, chat.id),
    queryFn: ({ signal }) => session.adapter.getMessages(chat.id, signal),
    meta: { errorHandling: 'local' },
    retry: (failures, error) => {
      if (!('credentials' in session) || failures >= 2) return false
      const { code, status } = normalizeError(error)
      return code === 'network' || code === 'http' && (status === 429 || status !== undefined && status >= 500)
    },
    retryDelay: 1200,
  })
  const sendText = useSendText(session, chat.id, () => onDraftChange(''))
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const historyRef = useRef<HTMLDivElement>(null)
  const sendButtonRef = useRef<HTMLButtonElement>(null)
  const lastMessageId = messages.data?.at(-1)?.id
  const lastIncomingId = messages.data?.findLast(message => message.direction === 'incoming')?.id
  useQuery({
    enabled: 'credentials' in session && visible && messages.isSuccess && !!lastIncomingId,
    queryKey: ['session', session.id, session.messenger, 'read-chat', chat.id, lastIncomingId],
    queryFn: async ({ signal }) => {
      await session.adapter.readChat(chat.id, signal)
      return true
    },
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [lastMessageId])

  useEffect(() => {
    if (!sendingEnabled) return
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) sendButtonRef.current?.click()
    }
    window.addEventListener('keydown', handleEnter, true)
    return () => window.removeEventListener('keydown', handleEnter, true)
  }, [sendingEnabled])

  return (
    <Card
      aria-label={`Разговор: ${chat.title}`}
      className={styles.conversation}
      classNames={{ body: styles.conversationBody }}
      role="region"
      size="small"
      title={
        <Flex align="center" className={styles.panelTitle} gap="small">
          <Button aria-label="Назад к списку чатов" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <Avatar
            aria-hidden
            className={styles.fixed}
            size="small"
            style={{ backgroundColor: token.colorPrimary }}
          >
            {chat.title.slice(0, 1)}
          </Avatar>
          <Flex className={styles.chatSummary} gap={8}>
            <Typography.Text ellipsis strong>
              {chat.title}
            </Typography.Text>
            <Typography.Text ellipsis type="secondary">
              {chat.phone}
            </Typography.Text>
          </Flex>
        </Flex>
      }
    >
      <Flex className={styles.conversationContent} gap="middle" vertical>
        <Card
          aria-busy={messages.isPending}
          aria-label="История сообщений"
          className={styles.history}
          classNames={{ body: styles.historyBody }}
          loading={messages.isPending}
          role="region"
          size="small"
          styles={{ root: { backgroundColor: token.colorPrimaryBg } }}
        >
          <div className={styles.historyScroll} ref={historyRef}>
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
                <Flex className={styles.messageList} gap="small" vertical>
                  {
                    messages.data.map(message => (
                      <Flex justify={message.direction === 'incoming' ? 'flex-start' : 'flex-end'} key={message.id}>
                        <Card
                          className={styles.message}
                          size="small"
                          styles={
                            {
                              root: {
                                backgroundColor: message.direction === 'outgoing' ? token.colorPrimaryBgHover : token.colorBgElevated,
                                borderColor: message.direction === 'outgoing' ? token.colorPrimaryBorder : token.colorBorderSecondary,
                              },
                            }
                          }
                        >
                          <Flex gap="small" wrap>
                            <Typography.Text strong>
                              {message.author}
                            </Typography.Text>
                          </Flex>
                          <Typography.Paragraph className={styles.messageText}>
                            {message.text}
                          </Typography.Paragraph>
                          <Flex gap="small" justify="flex-end" wrap>
                            <Typography.Text type="secondary">
                              {messageStatus(message, 'credentials' in session)}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              <time dateTime={new Date(message.timestamp).toISOString()}>
                                {new Date(message.timestamp).toLocaleString('ru-RU')}
                              </time>
                            </Typography.Text>
                          </Flex>
                        </Card>
                      </Flex>
                    ))
                  }
                </Flex>
              ) : (
                <Flex className={styles.emptyState}>
                  <Empty description="Сообщений пока нет" />
                </Flex>
              )
            }
          </div>
        </Card>
        <Flex className={styles.fixed} gap="small" vertical>
          <Flex gap="small" vertical>
            <Input
              aria-label="Сообщение"
              disabled={sendText.isPending}
              id="message-draft"
              onChange={event => onDraftChange(event.target.value)}
              placeholder="Введите текст сообщения"
              size="large"
              suffix={
                <Button
                  aria-label="Отправить"
                  disabled={!draft.trim() || sendText.isPending || messages.isPending}
                  icon={<SendOutlined />}
                  loading={sendText.isPending}
                  onClick={() => { if (!messages.isPending) sendText.send(draft) }}
                  ref={sendButtonRef}
                  shape="circle"
                  type="primary"
                />
              }
              value={draft}
            />
          </Flex>
        </Flex>
      </Flex>
    </Card>
  )
}
