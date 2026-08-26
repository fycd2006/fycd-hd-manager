/**
 * Normalizes row data keys from legacy numeric format ("1", "2") to
 * the canonical "field_1", "field_2" format.
 *
 * This handles a data migration edge case where some rows were stored
 * with bare numeric keys instead of prefixed ones.
 *
 * Mutates and returns the same object for performance (avoids copying
 * on hot paths like row-updated WebSocket events).
 */
export function normalizeRowData<T extends Record<string, unknown>>(data: T): T {
  const record = data as Record<string, unknown>
  const keys = Object.keys(record)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (/^\d+$/.test(k)) {
      const canonical = `field_${k}`
      if (!(canonical in record)) {
        record[canonical] = record[k]
      }
      delete record[k]
    }
  }
  return data
}
