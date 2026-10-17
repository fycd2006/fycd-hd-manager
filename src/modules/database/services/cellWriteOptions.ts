import type { Prisma } from '@prisma/client'
import type { SelectChoice } from '../fields/types/selectChoices'
import { mergeChoicesIntoOptions } from './cellWrite'

/**
 * Re-reads each field inside the transaction and merges the new choices into its
 * current options, so choices added concurrently by others are preserved.
 */
export async function applyOptionAdditions(
  tx: Prisma.TransactionClient,
  tableId: number,
  additions: Record<number, SelectChoice[]>,
): Promise<Array<{ id: number; options: unknown }>> {
  const updated: Array<{ id: number; options: unknown }> = []
  for (const [fieldIdStr, choices] of Object.entries(additions)) {
    const id = Number(fieldIdStr)
    const field = await tx.tableField.findFirst({ where: { id, tableId, deletedAt: null } })
    if (!field) continue
    const options = mergeChoicesIntoOptions(field.options, choices)
    const saved = await tx.tableField.update({ where: { id }, data: { options: options as Prisma.InputJsonValue } })
    updated.push({ id: saved?.id ?? id, options: saved?.options ?? options })
  }
  return updated
}
