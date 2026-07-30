/**
 * Safe JSON parsing helper to prevent unhandled exceptions on invalid or corrupt JSON data.
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback
  try {
    const parsed = JSON.parse(jsonString)
    return parsed ?? fallback
  } catch (err) {
    console.warn('safeJsonParse failed to parse JSON string:', err)
    return fallback
  }
}
