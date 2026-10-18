import type { Prisma } from '@prisma/client'
import { extractChoices, type SelectChoice } from '../fields/types/selectChoices'
import { mergeChoicesIntoOptions } from './cellWrite'

function existingIdsByName(options: unknown): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of extractChoices(options)) {
    const r = (typeof c === 'string' ? { id: c, name: c } : c) as { id?: unknown; name?: unknown; value?: unknown }
    const name = String(r.name ?? r.value ?? '').trim().toLowerCase()
    const id = String(r.id ?? name).trim()
    if (name && !m.has(name)) m.set(name, id)
  }
  return m
}

/**
 * Locks each field row, re-reads it inside the transaction and merges the new choices into
 * its current options, so choices added concurrently by others are preserved.
 * `remap[fieldId][ourNewId] = existingId` lists additions dropped because a choice with
 * the same name already existed; callers must run applyChoiceRemap on the prepared row data.
 */
export async function applyOptionAdditions(
  tx: Prisma.TransactionClient,
  tableId: number,
  additions: Record<number, SelectChoice[]>,
): Promise<{ updated: Array<{ id: number; options: unknown }>; remap: Record<number, Record<string, string>> }> {
  const updated: Array<{ id: number; options: unknown }> = []
  const remap: Record<number, Record<string, string>> = {}
  for (const [fieldIdStr, choices] of Object.entries(additions)) {
    const id = Number(fieldIdStr)
    // TiDB snapshot isolation: a plain read takes no lock, so lock the row first.
    await tx.$queryRaw`SELECT id FROM TableField WHERE id = ${id} AND tableId = ${tableId} FOR UPDATE`
    const field = await tx.tableField.findFirst({ where: { id, tableId, deletedAt: null } })
    if (!field) continue

    const byName = existingIdsByName(field.options)
    const fieldRemap: Record<string, string> = {}
    for (const c of choices) {
      const existingId = byName.get(c.name.trim().toLowerCase())
      if (existingId !== undefined && existingId !== c.id) fieldRemap[c.id] = existingId
    }
    if (Object.keys(fieldRemap).length > 0) remap[id] = fieldRemap

    const options = mergeChoicesIntoOptions(field.options, choices)
    const saved = await tx.tableField.update({ where: { id }, data: { options: options as Prisma.InputJsonValue } })
    updated.push({ id: saved?.id ?? id, options: saved?.options ?? options })
  }
  return { updated, remap }
}
