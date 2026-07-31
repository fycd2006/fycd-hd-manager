/**
 * Airtable Authentication & API Gateway
 * Supports Personal Access Token (PAT) authentication and shared URL metadata fetching.
 */

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
export async function fetchAirtableSchemaWithToken(baseId: string, token: string) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Airtable API 請求失敗 (${res.status})`)
  }

  return res.json()
}
