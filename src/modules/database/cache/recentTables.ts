const MAX_RECENT = 5

const keyOf = (workspaceId: number) => `recentTables_${workspaceId}`

export function getRecentTables(workspaceId: number): number[] {
  try {
    const raw = localStorage.getItem(keyOf(workspaceId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function pushRecentTable(workspaceId: number, tableId: number): void {
  try {
    const next = [tableId, ...getRecentTables(workspaceId).filter(id => id !== tableId)].slice(0, MAX_RECENT)
    localStorage.setItem(keyOf(workspaceId), JSON.stringify(next))
  } catch {
    // 儲存空間不可用時忽略，預載只是優化
  }
}
