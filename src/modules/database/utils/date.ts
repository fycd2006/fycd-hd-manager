/**
 * Database Module - Date Formatting Utilities
 */

/**
 * Format any date input (ISO string, YYYY-MM-DD, timestamp, slash date) into clean YYYY-MM-DD string
 * Safe against UTC timezone shifts and compatible with HTML <input type="date">
 */
export function formatDateValue(val: any): string {
  if (val === null || val === undefined || val === '') return ''
  const str = String(val).trim()
  if (!str) return ''

  // 1. Direct match for YYYY-MM-DD or YYYY/MM/DD (including ISO strings like 2026-07-22T00:00:00.000Z)
  const matchIsoDate = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (matchIsoDate) {
    const y = matchIsoDate[1]
    const m = matchIsoDate[2].padStart(2, '0')
    const d = matchIsoDate[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 2. Fallback parse with Date object
  const dateObj = new Date(str)
  if (!isNaN(dateObj.getTime())) {
    const y = dateObj.getFullYear()
    const m = String(dateObj.getMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return str
}
