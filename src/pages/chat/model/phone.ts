// Синтаксический формат общего адаптера: + и 8–15 цифр, код страны не начинается с 0.
export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/[\s()-]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null
}
