import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Empty, Flex, Grid, Input, Typography } from 'antd'
import { useEffect, useRef } from 'react'

import type { Chat } from '@/shared/api'
import { normalizeError } from '@/shared/errors'
import type { Session } from '@/shared/session'

import { messageQueryKey } from '../api/chat-query-key'
import { useSendText } from '../api/use-send-text'
import styles from './chat-layout.module.css'

export function Conversation({ chat, session, draft, onDraftChange, onBack, sendingEnabled }: {
  chat: Chat
  session: Session
  draft: string
  onDraftChange: (draft: string) => void
  onBack: () => void
  sendingEnabled: boolean
}) {
  const screens = Grid.useBreakpoint()
  const messages = useQuery({
    queryKey: messageQueryKey(session, chat.id),
    queryFn: ({ signal }) => session.adapter.getMessages(chat.id, signal),
    meta: { errorHandling: 'local' },
    retry: false,
  })
  const sendText = useSendText(session, chat.id, () => onDraftChange(''))
  const historyRef = useRef<HTMLDivElement>(null)
  const sendButtonRef = useRef<HTMLButtonElement>(null)
  const lastMessageId = messages.data?.at(-1)?.id

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
          <Button aria-label="Назад к списку чатов" onClick={onBack}>
            ←
          </Button>
          <Avatar aria-hidden className={styles.fixed}>
            {chat.title.slice(0, 1)}
          </Avatar>
          <Flex className={styles.chatSummary} vertical>
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
                        <Card className={styles.message} size="small">
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
                          <Typography.Paragraph className={styles.messageText}>
                            {message.text}
                          </Typography.Paragraph>
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
            <label htmlFor="message-draft">
              Сообщение
            </label>
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: screens.md ? 6 : 3 }}
              disabled={sendText.isPending}
              id="message-draft"
              onChange={event => onDraftChange(event.target.value)}
              placeholder="Введите текст сообщения"
              value={draft}
            />
          </Flex>
          <div>
            <Button
              disabled={!draft.trim() || sendText.isPending || !messages.isSuccess}
              loading={sendText.isPending}
              onClick={() => { if (messages.isSuccess) sendText.send(draft) }}
              ref={sendButtonRef}
              type="primary"
            >
              Отправить
            </Button>
          </div>
        </Flex>
      </Flex>
    </Card>
  )
}
