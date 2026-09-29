import type { Messenger } from '@/shared/api'

export const loginPath = '/login'

export const messengerPaths = {
  max: '/max',
  whatsapp: '/whatsapp',
  telegram: '/telegram',
} satisfies Record<Messenger, string>
