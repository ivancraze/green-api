import { useQuery } from '@tanstack/react-query'
import { Avatar, Flex, Typography } from 'antd'

import type { Chat } from '@/shared/api'
import type { Session } from '@/shared/session'

import { messageQueryKey } from '../api/chat-query-key'
import styles from './chat-layout.module.css'

export function ChatPreview({ chat, session }: { chat: Chat, session: Session }) {
  const messages = useQuery({
    queryKey: messageQueryKey(session, chat.id),
    queryFn: ({ signal }) => session.adapter.getMessages(chat.id, signal),
    enabled: false,
    meta: { errorHandling: 'local' },
    retry: false,
  })
  const lastMessage = messages.data?.at(-1)

  return (
    <Flex align="center" gap="small">
      <Avatar aria-hidden className={styles.fixed}>
        {chat.title.slice(0, 1)}
      </Avatar>
      <Flex className={styles.chatSummary} vertical>
        <Typography.Text ellipsis strong>
          {chat.title}
        </Typography.Text>
        {
          lastMessage && (
            <Flex align="center" gap="small">
              <Typography.Text className={styles.chatPreview} ellipsis type="secondary">
                {lastMessage.text.replace(/\s+/g, ' ').slice(0, 80)}
              </Typography.Text>
              <Typography.Text className={styles.fixed} type="secondary">
                <time dateTime={new Date(lastMessage.timestamp).toISOString()}>
                  {new Date(lastMessage.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </Typography.Text>
            </Flex>
          )
        }
      </Flex>
    </Flex>
  )
}
