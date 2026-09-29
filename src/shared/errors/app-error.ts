const errorMessages = {
  'invalid-credentials': 'Проверьте HTTPS-адрес API, idInstance и токен из кабинета GREEN-API.',
  'invalid-max-phone': 'В MAX доступны номера России (+7) и Беларуси (+375) в международном формате.',
  'invalid-max-message': 'Введите сообщение длиной от 1 до 4000 символов.',
  'invalid-whatsapp-phone': 'Введите номер WhatsApp в международном формате: от 11 до 15 цифр после +.',
  'invalid-whatsapp-message': 'Введите сообщение длиной от 1 до 20000 символов.',
  'whatsapp-recipient-unavailable': 'Аккаунт получателя не найден в WhatsApp.',
  'recipient-unavailable': 'Аккаунт получателя не найден в MAX.',
  'recipient-check-failed': 'Не удалось проверить получателя в MAX. Повторите попытку позже.',
  'instance-unavailable': 'Инстанс пока не готов к работе. Проверьте его состояние в кабинете GREEN-API и повторите подключение.',
  cancelled: 'Запрос отменён.',
  network: 'Не удалось связаться с сервером. Проверьте подключение к интернету и повторите попытку.',
  unauthorized: 'Не удалось подтвердить авторизацию. Проверьте данные подключения.',
  http: 'Сервер не смог выполнить запрос. Повторите попытку позже.',
  'invalid-response': 'Сервер вернул некорректный ответ. Повторите попытку позже.',
  unknown: 'Не удалось выполнить действие. Повторите попытку.',
} as const

export type AppErrorCode = keyof typeof errorMessages

// Не сохраняем исходную ошибку, URL и тело ответа: они могут содержать секреты.
export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status?: number

  constructor(code: AppErrorCode, status?: number) {
    super(errorMessages[code])
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if ((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError') {
    return new AppError('cancelled')
  }

  if (error instanceof Response && !error.ok) {
    return new AppError(
      error.status === 401 || error.status === 403 ? 'unauthorized' : 'http',
      error.status,
    )
  }

  // fetch отклоняет запрос с TypeError; неверный JSON даёт SyntaxError.
  if (error instanceof TypeError) return new AppError('network')
  if (error instanceof SyntaxError) return new AppError('invalid-response')

  return new AppError('unknown')
}
