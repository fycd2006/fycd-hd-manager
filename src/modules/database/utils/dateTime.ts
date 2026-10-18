// Shared date-time helpers (server + browser). Time zone math uses Intl only.
// Storage: date-only "YYYY-MM-DD"; with time, UTC ISO "YYYY-MM-DDTHH:mm:ss.sssZ".

export type DateFormat = 'local' | 'friendly' | 'us' | 'european' | 'iso'

export interface DateOptions {
  date_format: DateFormat
  date_include_time: boolean
  date_time_format: '12' | '24'
  date_time_zone: string
  date_show_time_zone: boolean
}

const DATE_FORMATS: DateFormat[] = ['local', 'friendly', 'us', 'european', 'iso']

const DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(T.*)?$/
const DATE_TIME_PATTERN =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function resolveDateOptions(options: unknown, fieldType?: string): DateOptions {
  let parsed: unknown = options
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      parsed = null
    }
  }
  const raw: Record<string, unknown> = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}

  const defaultIncludeTime = fieldType === 'created_on' || fieldType === 'last_modified_on'
  const zone = raw.date_time_zone
  return {
    date_format: DATE_FORMATS.find(f => f === raw.date_format) ?? 'iso',
    date_include_time: typeof raw.date_include_time === 'boolean' ? raw.date_include_time : defaultIncludeTime,
    date_time_format: raw.date_time_format === '12' ? '12' : '24',
    date_time_zone: zone !== 'client' && isValidTimeZone(zone) ? zone : 'client',
    date_show_time_zone: raw.date_show_time_zone === true,
  }
}

export function resolveTimeZone(options: DateOptions, viewerTz?: string): string {
  if (options.date_time_zone !== 'client' && isValidTimeZone(options.date_time_zone)) {
    return options.date_time_zone
  }
  if (isValidTimeZone(viewerTz)) return viewerTz
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (isValidTimeZone(local)) return local
  } catch {
    // fall through
  }
  return 'UTC'
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(utcMs)).map(x => [x.type, x.value])
  )
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000
}

function wallToUtcMs(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): number {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s)
  const first = naive - zoneOffsetMs(naive, timeZone)
  return naive - zoneOffsetMs(first, timeZone)
}

function isRealDate(y: number, mo: number, d: number): boolean {
  const check = new Date(Date.UTC(y, mo - 1, d))
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d
}

function parseDateOnly(value: string): string | null {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isRealDate(year, month, day)) return null
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

function zonedWall(ms: number, timeZone: string) {
  const offset = zoneOffsetMs(ms, timeZone)
  const d = new Date(ms + offset)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

export function normalizeDateInput(value: unknown, options: unknown, viewerTz?: string): string | null {
  if (value === null || value === undefined) return null
  const text = value instanceof Date ? (isNaN(value.getTime()) ? '' : value.toISOString()) : typeof value === 'string' ? value.trim() : ''
  if (!text) return null

  const opts = resolveDateOptions(options)
  if (!opts.date_include_time) return parseDateOnly(text)

  const m = DATE_TIME_PATTERN.exec(text)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = m[4] === undefined ? 0 : Number(m[4])
  const minute = m[5] === undefined ? 0 : Number(m[5])
  const second = m[6] === undefined ? 0 : Number(m[6])
  const ms = m[7] === undefined ? 0 : Number(m[7].padEnd(3, '0'))
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null

  let utcMs: number
  const offset = m[8]
  if (offset) {
    let offsetMin = 0
    if (offset.toUpperCase() !== 'Z') {
      const digits = offset.slice(1).replace(':', '')
      offsetMin = (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * (offset[0] === '-' ? -1 : 1)
    }
    utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60000
  } else {
    utcMs = wallToUtcMs(year, month, day, hour, minute, second, resolveTimeZone(opts, viewerTz))
  }
  utcMs += ms
  const out = new Date(utcMs)
  return isNaN(out.getTime()) ? null : out.toISOString()
}

export function cellDayInZone(value: unknown, timeZone: string): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDateOnly(text)
  if (!text.includes('T')) return null
  const ms = new Date(text).getTime()
  if (isNaN(ms)) return null
  const w = zonedWall(ms, isValidTimeZone(timeZone) ? timeZone : 'UTC')
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`
}

export function dayRangeUtc(day: string, timeZone: string): [string, string] {
  const [y, mo, d] = day.split('-').map(Number)
  const next = new Date(Date.UTC(y, mo - 1, d + 1))
  const start = wallToUtcMs(y, mo, d, 0, 0, 0, timeZone)
  const end = wallToUtcMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0, timeZone)
  return [new Date(start).toISOString(), new Date(end).toISOString()]
}

export function toEditorValue(value: unknown, options: unknown, viewerTz?: string): string {
  const opts = resolveDateOptions(options)
  if (!opts.date_include_time) {
    if (typeof value === 'string' && /T.*(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) {
      return cellDayInZone(value, resolveTimeZone(opts, viewerTz)) ?? ''
    }
    return normalizeDateInput(value, opts) ?? ''
  }
  if (typeof value !== 'string' || !value.trim()) return ''
  const text = value.trim()
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(text) ? parseDateOnly(text) : null
  if (dayOnly) return `${dayOnly}T00:00`
  const ms = new Date(text).getTime()
  if (isNaN(ms)) return ''
  const w = zonedWall(ms, resolveTimeZone(opts, viewerTz))
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
}

export function fromEditorValue(input: string, options: unknown, viewerTz?: string): string | null {
  return normalizeDateInput(input, options, viewerTz)
}

export function formatFieldDate(
  value: unknown,
  options: unknown,
  ctx?: { locale?: 'zh-TW' | 'en'; viewerTz?: string; fieldType?: string }
): string {
  if (value === null || value === undefined) return ''
  const raw = value instanceof Date ? (isNaN(value.getTime()) ? '' : value.toISOString()) : typeof value === 'string' ? value.trim() : String(value)
  if (!raw) return ''

  const opts = resolveDateOptions(options, ctx?.fieldType)
  const locale = ctx?.locale ?? 'zh-TW'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? parseDateOnly(raw) : null

  const timeZone = resolveTimeZone(opts, ctx?.viewerTz)
  let year: number, month: number, day: number, hour = 0, minute = 0
  let instantMs: number
  if (dateOnly) {
    ;[year, month, day] = dateOnly.split('-').map(Number)
    instantMs = Date.UTC(year, month - 1, day, 12)
  } else {
    if (!raw.includes('T')) return raw
    const ms = new Date(raw).getTime()
    if (isNaN(ms)) return raw
    const w = zonedWall(ms, timeZone)
    ;({ year, month, day, hour, minute } = w)
    instantMs = ms
  }

  let datePart: string
  if (opts.date_format === 'local' || opts.date_format === 'friendly') {
    datePart = new Intl.DateTimeFormat(locale, {
      dateStyle: opts.date_format === 'local' ? 'short' : 'long',
      timeZone: dateOnly ? 'UTC' : timeZone,
    }).format(new Date(instantMs))
  } else if (opts.date_format === 'us') {
    datePart = `${pad(month)}/${pad(day)}/${pad(year, 4)}`
  } else if (opts.date_format === 'european') {
    datePart = `${pad(day)}/${pad(month)}/${pad(year, 4)}`
  } else {
    datePart = `${pad(year, 4)}-${pad(month)}-${pad(day)}`
  }
  if (!opts.date_include_time) return datePart

  let timePart: string
  if (opts.date_time_format === '12') {
    timePart = `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`
  } else {
    timePart = `${pad(hour)}:${pad(minute)}`
  }
  let out = `${datePart} ${timePart}`
  if (opts.date_show_time_zone) {
    const label = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date(instantMs)).find(p => p.type === 'timeZoneName')?.value
    if (label) out += ` ${label}`
  }
  return out
}
