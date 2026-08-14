import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { evaluateFormula, extractFormulaExpression } from '@/lib/formula'
import { authorizeAction } from '@/lib/authorize'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'
import { syncBiDirectionalLinkRow, cleanupRowLinkRowRelations, parseLinkRowIds, type LinkSyncResult } from '@/modules/database/services/linkRowSync'
import { authorizeLinkRowOperation } from '@/modules/database/services/linkRowOperations'
import { softDeleteMasterViewOverrides } from '@/modules/database/services/masterViewOverride'
import { invalidateMasterViewCache } from '@/modules/database/services/masterViewCache'
import { FieldRegistry } from '@/modules/database/fields/types'
import { getPopulatedTableRows } from '@/modules/database/services/rowQuery'
import { createTableRow } from '@/modules/database/services/createRow'
import { safeJsonParse } from '@/lib/json-utils'
import { triggerTableEvent } from '@/lib/pusher-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getSessionUsername() {
  const user = await getSessionUser()
  return user?.username || '系統 (System)'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    // 讀取資料列同樣需要登入且為工作區成員（含 viewer 角色）
    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canViewData' })
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const sortField = searchParams.get('sort')
    const sortOrder = searchParams.get('order') || 'asc'
    const filterParam = searchParams.get('filter')
    const searchQuery = searchParams.get('search')?.trim()
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    const result = await getPopulatedTableRows(id, {
      sortField,
      sortOrder,
      filterParam,
      searchQuery,
      pageParam,
      pageSizeParam
    })

    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }

    if (result.isPaginated) {
      return NextResponse.json(result.data, { headers: noCacheHeaders })
    }

    return NextResponse.json(result.rows, { headers: noCacheHeaders })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API GET /api/tables/[tableId]/rows Error]:', error)
    return NextResponse.json({ error: msg || '查詢資料列失敗' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canEditData' })
    if (errorResponse) return errorResponse

    const body = await request.json()

    // Merge top-level keys with body.data (body.data takes precedence per key)
    const input = { ...(body ?? {}), ...(body?.data ?? {}) }
    const username = await getSessionUsername()

    const result = await createTableRow({ tableId: id, input, username })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const createdRow = result.row
    const socketId = body?.socket_id || body?.data?.socket_id
    triggerTableEvent(id, 'row-created', { row: createdRow }, socketId)

    return NextResponse.json(createdRow, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '新增資料列失敗' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canEditData' })
    if (errorResponse) return errorResponse

    let body: any
    try {
      body = await request.json()
    } catch (e) {
      console.warn(`[PATCH 400] Invalid JSON body. Error:`, e)
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const { rowId, data, fieldKey, value, socket_id: socketId } = body
    const rid = parseInt(rowId)
    if (isNaN(rid)) {
      console.warn(`[PATCH 400] Invalid rowId received:`, rowId)
      return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })
    }

    // Consolidate into single transaction to use 1 connection instead of 4+
    const { currentRow, fields } = await prisma.$transaction(async (tx) => {
      const row = await tx.tableRow.findFirst({
        where: { id: rid, tableId: tid, deletedAt: null },
        select: { data: true }
      })
      const flds = await tx.tableField.findMany({ 
        where: { tableId: tid, deletedAt: null },
        orderBy: { order: 'asc' }
      })
      return { currentRow: row, fields: flds }
    }, { maxWait: 5000, timeout: 10000 })

    if (!currentRow) {
      return NextResponse.json({ error: '找不到該資料列' }, { status: 404 })
    }
    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

    let updateMap: Record<string, any> = {}
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      updateMap = { ...data }
    }
    if (fieldKey !== undefined) {
      updateMap[fieldKey] = value
    }

    for (const f of fields) {
      const key = `field_${f.id}`
      if (f.type === 'last_modified_by') {
        updateMap[key] = username
      } else if (f.type === 'last_modified_on') {
        updateMap[key] = nowStr
      } else if (key in updateMap) {
        let fOpts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
        const fieldType = FieldRegistry.get(f.type)
        const validateRes = fieldType.validateValue(updateMap[key], fOpts)
        if (!validateRes.valid) {
          console.warn(`[PATCH 400] Validation failed for field ${f.name} (id: ${f.id}) on row ${rid}. Value:`, updateMap[key], `Error:`, validateRes.error);
          return NextResponse.json({ error: `欄位 [${f.name}] 驗證失敗: ${validateRes.error}` }, { status: 400 })
        }
        updateMap[key] = validateRes.parsedValue
      }
    }

    const validFieldKeys = new Set(fields.map(f => `field_${f.id}`))
    const entries = Object.entries(updateMap).filter(([k]) => /^field_\d+$/.test(k) && validFieldKeys.has(k))
    if (entries.length > 0) {
      let currentData: Record<string, any> = {}
      if (currentRow.data) {
        try {
          currentData = typeof currentRow.data === 'string' ? JSON.parse(currentRow.data) : currentRow.data
        } catch {
          currentData = {}
        }
      }

        // Detect link_row field changes to trigger bi-directional synchronization and validate target permissions
        const linkRowFields = fields.filter(f => f.type === 'link_row')
        const linkRowSyncTasks: Promise<LinkSyncResult | null>[] = []

        for (const f of linkRowFields) {
          const key = `field_${f.id}`
          if (key in updateMap) {
            const oldVal = currentData[key]
            const newVal = updateMap[key]

            const oldIds = parseLinkRowIds(oldVal)
            const newIds = parseLinkRowIds(newVal)

            // Security: If new target IDs are being linked, ensure the user has canViewData on the target table (Case #10 Blind linking prevention)
            const newlyAddedIds = newIds.filter(id => !oldIds.includes(id))
            if (newlyAddedIds.length > 0) {
              const fOpts: Record<string, any> = typeof f.options === 'string' ? safeJsonParse(f.options, {}) : (f.options || {})
              const targetTableId = Number(fOpts.targetTableId ?? fOpts.link_row_table_id ?? fOpts.target_table_id)
              if (targetTableId) {
                const { allowed, errorResponse } = await authorizeLinkRowOperation({
                  operation: 'link_existing',
                  sourceTableId: tid,
                  targetTableId,
                })
                if (!allowed && errorResponse) {
                  return errorResponse
                }
              }
            }

            // Per-task error isolation: one failing field must not block the others
            linkRowSyncTasks.push(
              syncBiDirectionalLinkRow(tid, rid, f.id, newIds, oldIds).catch(err => {
                console.warn('[Bi-directional Sync Warning]:', err)
                return null
              })
            )
          }
        }

        // Normalize currentData: migrate legacy numeric keys and purge stale numeric keys
        const normalizedData: Record<string, any> = {}
        Object.entries(currentData).forEach(([k, v]) => {
          const fid = parseInt(k.replace('field_', ''))
          if (!isNaN(fid) && validFieldKeys.has(`field_${fid}`)) {
            normalizedData[`field_${fid}`] = v
          } else if (/^field_\d+$/.test(k)) {
            normalizedData[k] = v
          }
        })
        currentData = normalizedData

        entries.forEach(([k, val]) => {
          const fid = parseInt(k.replace('field_', ''))
          if (!isNaN(fid)) {
            delete currentData[String(fid)]
            delete currentData[fid]
          }
          currentData[k] = val ?? null
        })

        // Recompute current row formulas dynamically when any cell in row is updated
        const formulaFields = fields.filter(f => f.type === 'formula')
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = extractFormulaExpression(ff.options)
          if (!expr) return
          try {
            const fieldOrder = fields.map(f => f.id)
            const res = evaluateFormula(expr, currentData, fieldOrder)
            currentData[destKey] = res != null ? String(res) : ''
          } catch {
            currentData[destKey] = '#VALUE!'
          }
        })

        const updatedRow = await prisma.tableRow.update({
          where: { id: rid },
          data: {
            data: currentData as Prisma.InputJsonValue,
            updatedAt: new Date()
          }
        })

        // Single-level cascade recomputation: computes dependent lookup/formula fields and returns affectedRows
        let affectedRows: any[] = []
        try {
          affectedRows = (await cascadeRecomputeSingleLevel(tid, rid)) || []
        } catch (e) {
          console.warn('[Cascade Recompute Warning]:', e)
        }

        // Execute bi-directional link_row sync tasks asynchronously but wait for them
        if (linkRowSyncTasks.length > 0) {
          try {
            const syncResults = await Promise.allSettled(linkRowSyncTasks)
            syncResults.forEach((res, i) => {
              if (res.status === 'rejected') {
                console.warn(`[Bi-directional Sync Warning] Task ${i} failed:`, res.reason)
              }
            })
          } catch (err) {
            console.warn('[Bi-directional Sync Fatal Warning]:', err)
          }
        }

        triggerTableEvent(tid, 'row-updated', {
          rowId: rid,
          data: currentData,
          affectedRows,
          fieldKey,
          value,
          updatedAt: updatedRow.updatedAt
        }, socketId)

        // Return immediately with updated row and affected dependent rows
        return NextResponse.json({ ...updatedRow, data: currentData, affectedRows })
      }

    // If no fields were updated (entries.length === 0), re-fetch
    const updated = await prisma.tableRow.findUnique({
      where: { id: rid }
    })

    if (!updated) return NextResponse.json({ error: '找不到該列' }, { status: 404 })

    return NextResponse.json({ ...updated, data: safeJsonParse(updated.data, {}) })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '更新資料列失敗' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canEditData' })
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const rowIdStr = searchParams.get('rowId')
    if (!rowIdStr) return NextResponse.json({ error: '缺少 rowId 參數' }, { status: 400 })
    
    const rid = parseInt(rowIdStr)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    // Cleanup bi-directional reverse link references and master view overrides before soft-deleting row
    try {
      await Promise.all([
        cleanupRowLinkRowRelations(tid, rid),
        softDeleteMasterViewOverrides(tid, rid),
      ])
    } catch (cleanupErr) {
      console.warn('[Row Cleanup Warning]:', cleanupErr)
    }

    const socketId = searchParams.get('socket_id') || undefined

    const existingRow = await prisma.tableRow.findUnique({ where: { id: rid }, select: { tableId: true } })
    if (!existingRow || existingRow.tableId !== tid) {
      return NextResponse.json({ error: '找不到該列或無權限' }, { status: 404 })
    }

    await prisma.tableRow.update({
      where: { id: rid },
      data: { deletedAt: new Date() }
    })

    // Invalidate master view cache for this table's workspace
    const parentTable = await prisma.databaseTable.findUnique({
      where: { id: tid },
      select: { database: { select: { workspaceId: true } } },
    })
    if (parentTable?.database?.workspaceId) {
      invalidateMasterViewCache(parentTable.database.workspaceId).catch(() => {})
    }

    triggerTableEvent(tid, 'row-deleted', { rowId: rid }, socketId)

    return NextResponse.json({ message: '資料列已刪除' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '刪除資料列失敗' }, { status: 500 })
  }
}


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canEditData' })
    if (errorResponse) return errorResponse

    const { rowOrders } = await request.json()
    if (!Array.isArray(rowOrders)) {
      return NextResponse.json({ error: '無效的排序資料' }, { status: 400 })
    }

    // Validate and normalize IDs (drop anything that is not a positive integer)
    const rowIds: number[] = rowOrders
      .map((v: unknown) => (typeof v === 'number' ? v : parseInt(String(v))))
      .filter((v: number) => Number.isInteger(v) && v > 0)

    if (rowIds.length > 0) {
      // Batched UPDATE via CASE WHEN instead of the legacy N+1 per-row
      // findUnique+update loop. All column names are hard-coded; every
      // dynamic value is bound through placeholders (no SQL injection).
      // `AND tableId = ?` preserves the legacy ownership guard: rows that
      // do not belong to this table are silently skipped.
      const CHUNK_SIZE = 500
      await prisma.$transaction(async (tx) => {
        for (let start = 0; start < rowIds.length; start += CHUNK_SIZE) {
          const chunk = rowIds.slice(start, start + CHUNK_SIZE)
          let sql = 'UPDATE TableRow SET `order` = CASE id '
          const params: any[] = []
          chunk.forEach((rowId, i) => {
            sql += 'WHEN ? THEN ? '
            params.push(rowId, start + i)
          })
          sql += `ELSE \`order\` END WHERE id IN (${chunk.map(() => '?').join(', ')}) AND tableId = ?`
          params.push(...chunk, tid)
          await tx.$executeRawUnsafe(sql, ...params)
        }
      }, {
        maxWait: 5000,
        timeout: 20000
      })
    }

    return NextResponse.json({ message: '資料列順序已儲存' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '儲存資料列順序失敗' }, { status: 500 })
  }
}

