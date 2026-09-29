export type Messenger = 'max' | 'whatsapp' | 'telegram'

export interface ConnectionCredentials {
  messenger: Messenger
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export interface Chat {
  id: string
  title: string
  phone: string
}

export interface Message {
  id: string
  chatId: string
  direction: 'incoming' | 'outgoing'
  author: string
  text: string
  timestamp: number
  status?: 'sent' | 'delivered' | 'read' | 'failed'
}

export interface Notification {
  receiptId: string
  message: Message | null
  chat?: Chat
}

// Credentials передаются реальному адаптеру при создании, а не каждому запросу.
// sendText возвращает принятое API сообщение, без обещания доставки.
export interface MessengerAdapter {
  readonly messenger: Messenger
  checkConnection(signal: AbortSignal): Promise<void>
  getChats(signal: AbortSignal): Promise<Chat[]>
  getMessages(chatId: string, signal: AbortSignal): Promise<Message[]>
  // Принимает уже нормализованный международный номер с ведущим +.
  resolveRecipient(phone: string, signal: AbortSignal): Promise<Chat>
  sendText(chatId: string, text: string, signal: AbortSignal): Promise<Message>
  readChat(chatId: string, signal: AbortSignal): Promise<void>
  // null — пустая очередь; уведомление повторяется до подтверждения.
  receiveNotification(signal: AbortSignal): Promise<Notification | null>
  acknowledgeNotification(receiptId: string, signal: AbortSignal): Promise<void>
}
