export interface SelectChoice {
  id: string;
  name: string;
  color?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers read choice members directly
export function extractChoices(options: unknown): any[] {
  if (!options) return []
  let opts: unknown = options
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts)
      if (typeof opts === 'string') opts = JSON.parse(opts)
    } catch {
      return []
    }
  }
  if (Array.isArray(opts)) return opts
  const o = opts as { choices?: unknown; select_options?: unknown; options?: unknown } | null
  if (Array.isArray(o?.choices)) return o.choices
  if (Array.isArray(o?.select_options)) return o.select_options
  if (Array.isArray(o?.options)) return o.options
  return []
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function normalizeChoices(options: unknown): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = []
  for (const c of extractChoices(options)) {
    if (!c) continue
    if (typeof c === 'string') {
      const s = c.trim()
      if (s) result.push({ id: s, name: s })
      continue
    }
    if (typeof c !== 'object') continue
    const r = c as { id?: unknown; name?: unknown; value?: unknown }
    const name = str(r.name) || str(r.value)
    const id = str(r.id) || name
    if (id || name) result.push({ id, name })
  }
  return result
}

function splitInput(value: unknown, mode: 'single' | 'multi'): string[] {
  let items: unknown[]
  if (mode === 'single') {
    items = [Array.isArray(value) ? JSON.stringify(value) : value]
  } else if (Array.isArray(value)) {
    items = value
  } else if (typeof value === 'string') {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = undefined
    }
    items = Array.isArray(parsed) ? parsed : value.split(',')
  } else {
    items = [value]
  }
  return items.map(str).filter(Boolean)
}

export function resolveChoices(
  value: unknown,
  options: unknown,
  mode: 'single' | 'multi',
): { ids: string[]; unknown: string[] } {
  const choices = normalizeChoices(options)
  const ids: string[] = []
  const unknown: string[] = []
  const seenUnknown = new Set<string>()

  for (const item of splitInput(value, mode)) {
    const lower = item.toLowerCase()
    const hit =
      choices.find(c => c.id === item) ??
      choices.find(c => c.name && c.name.toLowerCase() === lower)
    if (hit) {
      if (!ids.includes(hit.id)) ids.push(hit.id)
    } else if (!seenUnknown.has(lower)) {
      seenUnknown.add(lower)
      unknown.push(item)
    }
  }
  return { ids, unknown }
}
