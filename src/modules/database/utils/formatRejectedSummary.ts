import type { TableField } from '../types'

/**
 * Builds the toast text for cells the server refused to write, e.g.
 * 已寫入 3 格，2 格未寫入：數量 必須是有效的數字
 * Shows at most the first two distinct reasons, joined by 「、」.
 */
export function formatRejectedSummary(
  written: number,
  rejected: Array<{ fieldId: number; reason: string }>,
  fields: Array<Pick<TableField, 'id' | 'name'>>
): string {
  const reasons: string[] = []
  for (const rej of rejected) {
    const name = fields.find(f => f.id === rej.fieldId)?.name ?? `欄位 ${rej.fieldId}`
    const text = `${name} ${rej.reason}`
    if (!reasons.includes(text)) reasons.push(text)
    if (reasons.length === 2) break
  }
  return `已寫入 ${Math.max(written, 0)} 格，${rejected.length} 格未寫入：${reasons.join('、')}`
}
