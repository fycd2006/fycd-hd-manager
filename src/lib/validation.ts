export function sanitizeSearchQuery(query: unknown, maxLength = 100): string {
  if (typeof query !== 'string') return ''
  const sanitized = query.trim().slice(0, maxLength)
  return sanitized.replace(/[<>\"']/g, '')
}

export function parsePositiveInt(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue
  const parsed = Number(value)
  if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return defaultValue
  }
  return parsed
}

