/**
 * Safe JSON parsing helper to prevent unhandled exceptions on invalid or corrupt JSON data.
 */
export function safeJsonParse<T>(jsonString: any, fallback: T): T {
  if (!jsonString) return fallback
  if (typeof jsonString === 'object') return jsonString as T
  try {
    const parsed = JSON.parse(jsonString)
    return parsed ?? fallback
  } catch (err) {
    return fallback
  }
}
