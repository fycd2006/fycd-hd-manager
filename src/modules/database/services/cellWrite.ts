import { randomUUID } from 'crypto'
import { FieldRegistry } from '../fields/types'
import type { RejectCode } from '../fields/FieldType'
import { DEFAULT_COLORS, extractChoices, resolveChoices, type SelectChoice } from '../fields/types/selectChoices'
import { parseLatestCommentEntries } from '../fields/types/LatestCommentFieldType'

export interface FieldMeta {
  id: number
  name: string
  type: string
  options: unknown
}

export interface CellRejection {
  fieldId: number
  code: RejectCode
  reason: string
}

type CellWriteMode = 'create' | 'update'
type Actor = { username: string }

const FIELD_KEY = /^field_(\d+)$/

function choiceName(c: unknown): string {
  if (typeof c === 'string') return c.trim()
  if (c && typeof c === 'object') {
    const r = c as { name?: unknown; value?: unknown }
    return String(r.name ?? r.value ?? '').trim()
  }
  return ''
}

/**
 * Merge new choices into a select field's options, keeping the original container
 * (array, `choices`, `select_options` or `options`). Names that already exist
 * (case-insensitive) are not added again.
 */
export function mergeChoicesIntoOptions(options: unknown, additions: SelectChoice[]): unknown {
  let opts: unknown = options
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts)
      if (typeof opts === 'string') opts = JSON.parse(opts)
    } catch {
      opts = null
    }
  }
  const seen = new Set(extractChoices(opts).map((c) => choiceName(c).toLowerCase()))
  const fresh: SelectChoice[] = []
  for (const a of additions) {
    const key = a.name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    fresh.push(a)
  }
  if (Array.isArray(opts)) return [...opts, ...fresh]
  const base = opts && typeof opts === 'object' ? (opts as Record<string, unknown>) : {}
  for (const k of ['choices', 'select_options', 'options']) {
    if (Array.isArray(base[k])) return { ...base, [k]: [...(base[k] as unknown[]), ...fresh] }
  }
  return { ...base, choices: fresh }
}

/**
 * Replaces ids of choices that were dropped as duplicates (see applyOptionAdditions)
 * with the ids that already exist. Returns a new object; other fields are untouched.
 */
export function applyChoiceRemap(
  data: Record<string, unknown>,
  fields: FieldMeta[],
  remap: Record<number, Record<string, string>>,
): Record<string, unknown> {
  const out = { ...data }
  for (const f of fields) {
    const map = remap[f.id]
    const key = `field_${f.id}`
    if (!map || !(key in out)) continue
    const v = out[key]
    const type = FieldRegistry.get(f.type).type
    if (type === 'single_select' && typeof v === 'string' && v in map) {
      out[key] = map[v]
    } else if (type === 'multiple_select' && typeof v === 'string') {
      let ids: unknown
      try {
        ids = JSON.parse(v)
      } catch {
        continue
      }
      if (!Array.isArray(ids)) continue
      const mapped = ids.map((id) => (typeof id === 'string' && id in map ? map[id] : id))
      out[key] = JSON.stringify(mapped.filter((id, i) => mapped.indexOf(id) === i))
    }
  }
  return out
}

export function formatRejection(fieldName: string, r: CellRejection): string {
  return `欄位 [${fieldName}] 驗證失敗：${r.reason}`
}

interface Session {
  fields: Map<number, FieldMeta>
  mode: CellWriteMode
  canAddOptions: boolean
  actor?: Actor
  additions: Record<number, SelectChoice[]>
}

function effectiveOptions(s: Session, f: FieldMeta): unknown {
  const added = s.additions[f.id]
  return added?.length ? mergeChoicesIntoOptions(f.options, added) : f.options
}

function stampComments(parsed: unknown, existingValue: unknown, actor: Actor): unknown {
  if (!Array.isArray(parsed)) return parsed
  const stored = new Map(parseLatestCommentEntries(existingValue).map((e) => [String(e.id), e]))
  const now = new Date().toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' })
  return parsed.map((entry) => {
    const e = entry as { id: string | number; user: string; time: string }
    const prev = stored.get(String(e.id))
    if (prev) return { ...e, user: prev.user, time: prev.time }
    return { ...e, user: actor.username, time: now }
  })
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  return Array.isArray(v) && v.length === 0
}

function writeOne(
  s: Session,
  input: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): { data: Record<string, unknown>; rejected: CellRejection[] } {
  const data: Record<string, unknown> = {}
  const rejected: CellRejection[] = []

  for (const [key, raw] of Object.entries(input)) {
    const m = FIELD_KEY.exec(key)
    if (!m) continue
    const field = s.fields.get(Number(m[1]))
    if (!field) continue

    if (!FieldRegistry.isRegistered(field.type)) {
      rejected.push({ fieldId: field.id, code: 'unknown_type', reason: `不支援的欄位型別「${field.type}」` })
      continue
    }
    const ft = FieldRegistry.get(field.type)
    if (ft.readOnly) {
      // Blank placeholders (e.g. the client seeds every field with '') mean "not provided"
      if (isBlank(raw)) continue
      rejected.push({ fieldId: field.id, code: 'read_only', reason: '此欄位為唯讀，無法寫入' })
      continue
    }

    let result = ft.validateValue(raw, effectiveOptions(s, field))
    const isSelect = ft.type === 'single_select' || ft.type === 'multiple_select'
    if (!result.valid && result.code === 'unknown_option' && s.canAddOptions && isSelect) {
      const { unknown } = resolveChoices(raw, effectiveOptions(s, field), ft.type === 'single_select' ? 'single' : 'multi')
      const list = (s.additions[field.id] ??= [])
      const base = extractChoices(field.options).length
      for (const name of unknown) {
        list.push({ id: randomUUID(), name, color: DEFAULT_COLORS[(base + list.length) % DEFAULT_COLORS.length] })
      }
      result = ft.validateValue(raw, effectiveOptions(s, field))
    }

    if (!result.valid) {
      rejected.push({ fieldId: field.id, code: result.code, reason: result.error })
      continue
    }
    let value = result.parsedValue
    if (ft.type === 'latest_comment' && s.actor) {
      value = stampComments(value, existing?.[key], s.actor)
    }
    data[key] = value
  }

  if (s.mode === 'create') {
    for (const field of s.fields.values()) {
      const key = `field_${field.id}`
      if (key in input || !FieldRegistry.isRegistered(field.type)) continue
      const ft = FieldRegistry.get(field.type)
      if (ft.readOnly) continue
      const def = ft.getDefaultValue(field.options)
      if (def !== null && def !== undefined) data[key] = def
    }
  }

  return { data, rejected }
}

function newSession(args: {
  fields: FieldMeta[]
  mode: CellWriteMode
  canAddOptions: boolean
  actor?: Actor
}): Session {
  return {
    fields: new Map(args.fields.map((f) => [f.id, f])),
    mode: args.mode,
    canAddOptions: args.canAddOptions,
    actor: args.actor,
    additions: {},
  }
}

export function prepareCellWrites(args: {
  fields: FieldMeta[]
  input: Record<string, unknown>
  mode: CellWriteMode
  canAddOptions: boolean
  actor?: Actor
  existing?: Record<string, unknown>
}): { data: Record<string, unknown>; rejected: CellRejection[]; optionAdditions: Record<number, SelectChoice[]> } {
  const s = newSession(args)
  const { data, rejected } = writeOne(s, args.input, args.existing)
  return { data, rejected, optionAdditions: s.additions }
}

export function prepareBatchCellWrites<K>(args: {
  fields: FieldMeta[]
  rows: Array<{ key: K; input: Record<string, unknown>; existing?: Record<string, unknown> }>
  mode: CellWriteMode
  canAddOptions: boolean
  actor?: Actor
}): {
  rows: Array<{ key: K; data: Record<string, unknown>; rejected: CellRejection[] }>
  optionAdditions: Record<number, SelectChoice[]>
} {
  const s = newSession(args)
  const rows = args.rows.map((r) => ({ key: r.key, ...writeOne(s, r.input, r.existing) }))
  return { rows, optionAdditions: s.additions }
}
