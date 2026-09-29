import { expect, it } from 'vitest'

import { normalizePhone } from '@/pages/chat/model/phone'

it('нормализует международный телефон и отклоняет неверный ввод', () => {
  expect(normalizePhone(' +7 (900) 123-45-67 ')).toBe('+79001234567')
  for (const value of ['', '89001234567', '+012345678', '+1234567', '+1234567890123456', '+7900abc4567']) {
    expect(normalizePhone(value)).toBeNull()
  }
})
