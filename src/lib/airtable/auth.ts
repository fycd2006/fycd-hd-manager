/**
 * Airtable Authentication & API Gateway
 * Supports Personal Access Token (PAT) authentication and shared URL metadata fetching.
 */

import type { AirtableBasePayload, AirtableTableRaw } from './airtableImporter'

export interface FetchAirtableOptions {
  token?: string
  shareUrl?: string
}

/**
 * Extracts Base ID or Share ID from Airtable URL
 */
export function extractAirtableId(urlOrId: string): { type: 'share' | 'base' | 'unknown'; id: string } {
  if (!urlOrId) return { type: 'unknown', id: '' }
  const trimmed = urlOrId.trim()
  
  // Direct ID input — prioritize Base ID over Share ID
  if (trimmed.startsWith('app')) {
    return { type: 'base', id: trimmed }
  }
  if (trimmed.startsWith('shr')) {
    return { type: 'share', id: trimmed }
  }

  // URL parsing — always extract Base ID (app...) first
  const baseMatch = trimmed.match(/airtable\.com\/(app[a-zA-Z0-9]+)/)
  if (baseMatch) {
    return { type: 'base', id: baseMatch[1] }
  }

  const shareMatch = trimmed.match(/airtable\.com\/(shr[a-zA-Z0-9]+)/)
  if (shareMatch) {
    return { type: 'share', id: shareMatch[1] }
  }

  return { type: 'unknown', id: trimmed }
}

/**
 * Fetches Airtable base schema using Personal Access Token (PAT)
 */
export async function fetchAirtableSchemaWithToken(baseId: string, token: string): Promise<AirtableBasePayload> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const errObj = (err.error && typeof err.error === 'object' ? err.error : {}) as Record<string, unknown>
    throw new Error((errObj.message as string) || `Airtable API 請求失敗 (${res.status})`)
  }

  const data = (await res.json()) as { tables?: AirtableTableRaw[] }
  const tables: AirtableTableRaw[] = data.tables || []

  // Fetch records for each table with offset pagination and returnFieldsByFieldId=true
  for (const table of tables) {
    if (table.id && typeof table.id === 'string') {
      try {
        let allRecords: Array<{ id: string; cellValuesByFieldId: Record<string, unknown> }> = []
        let offset: string | null = null
        do {
          const query = new URLSearchParams({ returnFieldsByFieldId: 'true' })
          if (offset) query.set('offset', offset)

          const recordsRes = await fetch(`https://api.airtable.com/v0/${baseId}/${table.id}?${query.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
          if (!recordsRes.ok) {
            const err = (await recordsRes.json().catch(() => ({}))) as Record<string, unknown>
            console.warn(`[Airtable Auth] Failed to fetch records for table ${table.id} (${recordsRes.status}):`, err)
            break
          }
          const recData = (await recordsRes.json()) as {
            records?: Array<{ id: string; fields?: Record<string, unknown> }>
            offset?: string
          }
          const pageRecords = (recData.records || []).map(r => ({
            id: r.id,
            cellValuesByFieldId: r.fields || {},
          }))
          allRecords = allRecords.concat(pageRecords)
          offset = recData.offset || null
        } while (offset)

        table.records = allRecords
      } catch (err: unknown) {
        console.warn(`[Airtable Auth] Error fetching records for table ${table.id}:`, (err as Error)?.message)
        table.records = []
      }
    }
  }

  return { tables }
}
