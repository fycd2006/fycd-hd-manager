/**
 * Airtable Shared Link Scraping Engine
 *
 * Implements the same approach as Baserow's Airtable importer:
 * 1. Fetch the publicly shared base HTML page
 * 2. Extract `window.initData` and `requestId` from the page
 * 3. Use Airtable's internal v0.3 API to fetch full table schemas and records
 *
 * Reference: Baserow handler.py — fetch_publicly_shared_base / fetch_table_data
 */

import type { AirtableBasePayload, AirtableTableRaw } from './airtableImporter'

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:95.0) Gecko/20100101 Firefox/95.0',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
}

const AIRTABLE_BASE_URL = 'https://airtable.com'
const AIRTABLE_API_BASE_URL = `${AIRTABLE_BASE_URL}/v0.3`

// ─── Types ────────────────────────────────────────────────────────────────

interface AirtableInitData {
  rawApplications: Record<string, { name: string }>
  sharedApplicationId: string
  codeVersion: string
  pageLoadId: string
  accessPolicy: string
  singleApplicationScaffoldingData?: {
    tableById: Record<string, unknown>
  }
}

interface SharedBaseResult {
  requestId: string
  initData: AirtableInitData
  cookies: Record<string, string>
}

// ─── URL extraction ───────────────────────────────────────────────────────

/**
 * Extracts the share ID from a publicly shared Airtable URL.
 * Supports formats:
 *   - https://airtable.com/shrXXXXXXXXXXXXXX
 *   - https://airtable.com/appXXXXXXXXXX/shrXXXXXXXXXXXXXX
 *   - https://airtable.com/appXXXXXXXXXX (treated as base share)
 *   - shrXXXXXXXXXXXXXX (direct ID)
 *   - appXXXXXXXXXXXXXX (direct ID)
 */
export function extractShareIdFromUrl(publicBaseUrl: string): string {
  const trimmed = publicBaseUrl.trim()

  // Direct ID (e.g. "shrXXX" or "appXXX")
  if (/^(shr|app)[a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed
  }

  // Direct path with slash (e.g. "appXXX/shrXXX")
  if (/^app[a-zA-Z0-9]+\/shr[a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed
  }

  // URL — extract everything after airtable.com/ starting with shr or app
  // Baserow does: re.search(r"https:\/\/airtable.com\/(shr|app)(.*)$", url)
  // and returns the full match, preserving paths like "appXXX/shrXXX"
  const result = trimmed.match(/airtable\.com\/((shr|app)[a-zA-Z0-9/]+)/)
  if (result) {
    // Remove any trailing slashes or query params
    return result[1].replace(/\/+$/, '')
  }

  throw new Error(
    '無效的 Airtable 共享網址。請提供格式如 https://airtable.com/shrXXXX 或 https://airtable.com/appXXXX/shrXXXX 的連結。'
  )
}

// ─── Cookie parsing ──────────────────────────────────────────────────────

function parseCookiesFromHeaders(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {}
  const setCookieHeaders = headers.getSetCookie?.() ?? []
  for (const setCookie of setCookieHeaders) {
    const [pair] = setCookie.split(';')
    if (pair) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx > 0) {
        cookies[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim()
      }
    }
  }
  return cookies
}

function cookiesToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

// ─── Step 1: Fetch shared base HTML ──────────────────────────────────────

async function fetchPubliclySharedBase(shareId: string): Promise<SharedBaseResult> {
  const url = `${AIRTABLE_BASE_URL}/${shareId}`

  // First try with redirect: 'manual' to detect login redirects
  const checkResponse = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'manual',
    cache: 'no-store',
  })

  // Airtable redirects to /login if auth is required
  if (checkResponse.status === 301 || checkResponse.status === 302) {
    const location = checkResponse.headers.get('Location') ?? ''
    if (location.includes('/login') || location.includes('/signin')) {
      throw new Error(
        'Airtable 表示此共享連結需要登入才能存取。請確認該 Base 已設定為「公開共享」。'
      )
    }
  }

  // Now fetch with redirects followed
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Airtable 共享頁面請求失敗 (HTTP ${response.status})。請確認連結是否公開且有效。`)
  }

  const html = await response.text()

  // Check if we were redirected to a login page
  if (html.includes('Sign in to Airtable') || html.includes('signInPage')) {
    throw new Error(
      'Airtable 表示此共享連結需要登入才能存取。請確認該 Base 已設定為「公開共享」。'
    )
  }

  // Extract requestId
  const requestIdMatch = html.match(/requestId:\s*"([^"]+)"/)
  if (!requestIdMatch) {
    // Debug: log a snippet of the HTML to understand what we got
    console.error('[Airtable Scraper] requestId not found. HTML snippet (first 500 chars):', html.substring(0, 500))
    throw new Error(
      '無法從共享頁面中提取 requestId。該連結可能不是一個有效的 Shared Base 連結（可能是 Shared View）。'
    )
  }
  const requestId = requestIdMatch[1]

  // Extract window.initData — the JSON blob can be very large and multiline
  // Strategy: find "window.initData = " then parse the JSON by finding the matching closing brace
  let initData: AirtableInitData

  const initDataPrefix = 'window.initData = '
  const initDataIdx = html.indexOf(initDataPrefix)
  if (initDataIdx === -1) {
    console.error('[Airtable Scraper] window.initData not found. HTML snippet around requestId:', html.substring(Math.max(0, html.indexOf('requestId') - 200), html.indexOf('requestId') + 500))
    throw new Error('無法從共享頁面中提取 initData。Airtable 可能已更新其頁面結構。')
  }

  // Find the JSON start
  const jsonStart = initDataIdx + initDataPrefix.length
  // Use brace counting to find the end of the JSON object
  let braceCount = 0
  let jsonEnd = jsonStart
  let inString = false
  let escaped = false

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === '\\' && inString) {
      escaped = true
      continue
    }

    if (ch === '"' && !escaped) {
      inString = !inString
      continue
    }

    if (!inString) {
      if (ch === '{') braceCount++
      else if (ch === '}') {
        braceCount--
        if (braceCount === 0) {
          jsonEnd = i + 1
          break
        }
      }
    }
  }

  if (braceCount !== 0) {
    throw new Error('無法正確解析 initData JSON（括號不匹配）。')
  }

  const rawJson = html.substring(jsonStart, jsonEnd)
  try {
    initData = JSON.parse(rawJson)
  } catch (parseErr: any) {
    console.error('[Airtable Scraper] JSON parse error:', parseErr.message, 'JSON snippet (first 200 chars):', rawJson.substring(0, 200))
    throw new Error(`initData JSON 解析失敗: ${parseErr.message}`)
  }

  const cookies = parseCookiesFromHeaders(response.headers)

  if (!initData.sharedApplicationId && !('rawApplications' in initData)) {
    throw new Error('此連結不是一個 Shared Base。請使用「Share base」功能產生的連結。')
  }

  return { requestId, initData, cookies }
}

// ─── Step 2: Fetch table data via internal API ───────────────────────────

function buildAirtableApiHeaders(
  initData: AirtableInitData,
  _requestId: string
): Record<string, string> {
  const applicationId = Object.keys(initData.rawApplications)[0]
  return {
    ...BROWSER_HEADERS,
    'x-airtable-application-id': applicationId,
    'x-airtable-client-queue-time': '45',
    'x-airtable-inter-service-client': 'webClient',
    'x-airtable-inter-service-client-code-version': initData.codeVersion,
    'x-airtable-page-load-id': initData.pageLoadId,
    'X-Requested-With': 'XMLHttpRequest',
    'x-time-zone': 'Asia/Taipei',
    'x-user-locale': 'en',
    Accept: 'application/json',
  }
}

async function fetchTableData(
  tableId: string,
  initData: AirtableInitData,
  requestId: string,
  cookies: Record<string, string>,
  fetchApplicationStructure: boolean
): Promise<any> {
  const applicationId = Object.keys(initData.rawApplications)[0]
  const accessPolicy = JSON.parse(initData.accessPolicy)

  const stringifiedObjectParams: Record<string, any> = {
    includeDataForViewIds: null,
    shouldIncludeSchemaChecksum: true,
    mayOnlyIncludeRowAndCellDataForIncludedViews: false,
  }

  let url: string
  if (fetchApplicationStructure) {
    stringifiedObjectParams.includeDataForTableIds = [tableId]
    url = `${AIRTABLE_API_BASE_URL}/application/${applicationId}/read`
  } else {
    url = `${AIRTABLE_API_BASE_URL}/table/${tableId}/readData`
  }

  const params = new URLSearchParams({
    stringifiedObjectParams: JSON.stringify(stringifiedObjectParams),
    accessPolicy: JSON.stringify(accessPolicy),
    request_id: requestId,
  })

  const headers = buildAirtableApiHeaders(initData, requestId)

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      ...headers,
      Cookie: cookiesToHeader(cookies),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    console.error(`[Airtable Scraper] Table data fetch failed (${response.status}):`, errBody.substring(0, 500))
    throw new Error(`Airtable 資料請求失敗 (HTTP ${response.status})，table: ${tableId}`)
  }

  return response.json()
}

// ─── Step 3: Extract schema and combine ──────────────────────────────────

interface AirtableColumnSchema {
  id: string
  name: string
  type: string
  typeOptions?: any
}

interface AirtableTableSchema {
  id: string
  name: string
  columns: AirtableColumnSchema[]
  primaryColumnId: string
}

interface AirtableSchema {
  tableSchemas: AirtableTableSchema[]
}

function extractSchemaAndTables(
  exports: any[]
): { schema: AirtableSchema; tables: Record<string, any> } {
  let schema: AirtableSchema | null = null
  const tables: Record<string, any> = {}

  for (const exp of exports) {
    if (exp.data && 'appBlanket' in exp.data) {
      // This export contains the application schema
      const tableData = exp.data.tableDatas[0]
      schema = exp.data as AirtableSchema
      tables[tableData.id] = tableData
    } else if (exp.data) {
      tables[exp.data.id] = exp.data
    }
  }

  if (!schema) {
    throw new Error('無法從 Airtable 回應中提取資料庫結構。')
  }

  return { schema, tables }
}

// ─── Convert to our internal format ──────────────────────────────────────

function convertToBasePayload(
  schema: AirtableSchema,
  tables: Record<string, any>,
  baseName: string
): AirtableBasePayload {
  const convertedTables: AirtableTableRaw[] = schema.tableSchemas.map((tableSchema) => {
    const tableData = tables[tableSchema.id]
    const rows = tableData?.rows ?? []

    const fields = tableSchema.columns.map((col) => ({
      id: col.id,
      name: col.name,
      type: col.type,
      options: col.typeOptions
        ? {
            choices: col.typeOptions.choices
              ? Object.values(col.typeOptions.choices as Record<string, any>).map(
                  (c: any) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                  })
                )
              : undefined,
            linkedTableId: col.typeOptions.foreignTableId,
            isReversed: col.typeOptions.isReversed,
            formula: col.typeOptions.formulaTextParsed,
          }
        : undefined,
    }))

    const records = rows.map((row: any) => ({
      id: row.id,
      cellValuesByFieldId: row.cellValuesByColumnId ?? {},
    }))

    return {
      id: tableSchema.id,
      name: tableSchema.name,
      fields,
      records,
    }
  })

  return {
    name: baseName,
    tables: convertedTables,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Fetches all table data from a publicly shared Airtable link.
 * This uses the same scraping approach as Baserow.
 *
 * @param shareUrl - The Airtable shared base URL or share ID
 * @returns AirtableBasePayload ready for parseAirtableBasePayload()
 */
export async function fetchAllTablesFromSharedLink(
  shareUrl: string
): Promise<AirtableBasePayload> {
  // 1. Extract share ID from URL
  const shareId = extractShareIdFromUrl(shareUrl)

  // 2. Fetch the shared base HTML page and extract initData
  const { requestId, initData, cookies } = await fetchPubliclySharedBase(shareId)

  // 3. Determine the list of tables from initData
  const tableIds = Object.keys(
    initData.singleApplicationScaffoldingData?.tableById ?? {}
  )

  if (tableIds.length === 0) {
    throw new Error(
      'Airtable 共享頁面中未找到任何表格。請確認該 Base 有包含表格且已公開共享。'
    )
  }

  // 4. Fetch each table's data (first request includes schema)
  const exports: any[] = []
  for (let i = 0; i < tableIds.length; i++) {
    const tableId = tableIds[i]
    const result = await fetchTableData(
      tableId,
      initData,
      requestId,
      cookies,
      i === 0 // first table request includes application structure
    )
    exports.push(result)
  }

  // 5. Extract schema and combine table data
  const { schema, tables } = extractSchemaAndTables(exports)

  // 6. Get base name
  const applicationId = Object.keys(initData.rawApplications)[0]
  const baseName =
    initData.rawApplications[applicationId]?.name ?? 'Airtable Import'

  // 7. Convert to our internal format
  return convertToBasePayload(schema, tables, baseName)
}
