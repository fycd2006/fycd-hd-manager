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
import { invalidateMasterViewCache, invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
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
  const executeQuery = async () => {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    // 讀取資料列同樣需要登入且為工作區成員（含 viewer 角色）
    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canViewData' })
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const rowIdParam = searchParams.get('rowId')
    const sortField = searchParams.get('sort')
    const sortOrder = searchParams.get('order') || 'asc'
    const filterParam = searchParams.get('filter')
    const searchQuery = searchParams.get('search')?.trim()
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    const result = await getPopulatedTableRows(id, {
      rowId: rowIdParam ? parseInt(rowIdParam, 10) : undefined,
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
  }

  try {
    return await executeQuery()
  } catch (error: unknown) {
    const isTransient = error instanceof Error && (
      error.name === 'PrismaClientInitializationError' ||
      error.message.includes("Can't reach database server") ||
      error.message.includes('Connection lost') ||
      error.message.includes('ETIMEDOUT')
    )

    if (isTransient) {
      try {
        await new Promise(r => setTimeout(r, 350))
        return await executeQuery()
      } catch (retryError) {
        console.error('[API GET /api/tables/[tableId]/rows Retry Failed]:', retryError)
      }
    }

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

import { validateRowPatchPayload } from '@/modules/database/services/rowValidation'

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

    const fields = await prisma.tableField.findMany({
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' },
    })

    const currentRow = await prisma.tableRow.findFirst({
      where: { id: rid, tableId: tid, deletedAt: null },
      select: { id: true, data: true },
    })

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

    // Auto-update audit fields if present
    for (const f of fields) {
      const key = `field_${f.id}`
      if (f.type === 'last_modified_by') {
        updateMap[key] = username
      } else if (f.type === 'last_modified_on') {
        updateMap[key] = nowStr
      }
    }

    // 1. Zod Schema Dynamic Validation
    const validationRes = validateRowPatchPayload(updateMap, fields)
    if (!validationRes.valid) {
      return NextResponse.json({ error: validationRes.error }, { status: 400 })
    }

    // 2. FieldRegistry validation / transformation
    for (const f of fields) {
      const key = `field_${f.id}`
      if (key in updateMap && f.type !== 'last_modified_by' && f.type !== 'last_modified_on') {
        const fOpts = typeof f.options === 'string' ? safeJsonParse(f.options, {}) : (f.options || {})
        const fieldType = FieldRegistry.get(f.type)
        const validateRes = fieldType.validateValue(updateMap[key], fOpts)
        if (!validateRes.valid) {
          return NextResponse.json({ error: `欄位 [${f.name}] 驗證失敗: ${validateRes.error}` }, { status: 400 })
        }
        updateMap[key] = validateRes.parsedValue
      }
    }

    const validFieldKeys = new Set(fields.map((f) => `field_${f.id}`))
    const entries = Object.entries(updateMap).filter(([k]) => /^field_\d+$/.test(k) && validFieldKeys.has(k))

    if (entries.length > 0) {
      const currentData = safeJsonParse<Record<string, any>>(currentRow.data, {})

      // Detect link_row field changes to trigger bi-directional synchronization and validate target permissions
      const linkRowFields = fields.filter((f) => f.type === 'link_row')
      const linkRowSyncTasks: Promise<LinkSyncResult | null>[] = []

      for (const f of linkRowFields) {
        const key = `field_${f.id}`
        if (key in updateMap) {
          const oldVal = currentData[key]
          const newVal = updateMap[key]

          const oldIds = parseLinkRowIds(oldVal)
          const newIds = parseLinkRowIds(newVal)

          const newlyAddedIds = newIds.filter((id) => !oldIds.includes(id))
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

          linkRowSyncTasks.push(
            syncBiDirectionalLinkRow(tid, rid, f.id, newIds, oldIds).catch((err) => {
              console.warn('[Bi-directional Sync Warning]:', err)
              return null
            })
          )
        }
      }

      // 3. MySQL JSON_SET Atomic Parameterized Partial Update
      const setFragments: Prisma.Sql[] = []
      for (const [k, val] of entries) {
        const jsonPath = `$.${k}`
        if (val === null || val === undefined) {
          setFragments.push(Prisma.sql`${jsonPath}, CAST('null' AS JSON)`)
        } else if (typeof val === 'number') {
          if (Number.isFinite(val)) {
            setFragments.push(Prisma.sql`${jsonPath}, ${val}`)
          } else {
            setFragments.push(Prisma.sql`${jsonPath}, CAST('null' AS JSON)`)
          }
        } else if (typeof val === 'boolean') {
          setFragments.push(Prisma.sql`${jsonPath}, CAST(${val ? 'true' : 'false'} AS JSON)`)
        } else if (typeof val === 'object') {
          setFragments.push(Prisma.sql`${jsonPath}, CAST(${JSON.stringify(val)} AS JSON)`)
        } else {
          setFragments.push(Prisma.sql`${jsonPath}, ${String(val)}`)
        }
      }

      const now = new Date()
      await prisma.$executeRaw(
        Prisma.sql`UPDATE TableRow SET data = JSON_SET(COALESCE(data, '{}'), ${Prisma.join(setFragments, ', ')}), updatedAt = ${now} WHERE id = ${rid} AND tableId = ${tid} AND deletedAt IS NULL`
      )

      let updatedRow = await prisma.tableRow.findUnique({
        where: { id: rid },
      })
      if (!updatedRow) return NextResponse.json({ error: '找不到該列' }, { status: 404 })

      let rowData = safeJsonParse<Record<string, any>>(updatedRow.data, {})

      // 4. Recompute formula fields dynamically if present
      const formulaFields = fields.filter((f) => f.type === 'formula')
      if (formulaFields.length > 0) {
        const formulaFragments: Prisma.Sql[] = []
        let formulaChanged = false
        const fieldOrder = fields.map((f) => f.id)
        for (const ff of formulaFields) {
          const destKey = `field_${ff.id}`
          const jsonPath = `$.${destKey}`
          const expr = extractFormulaExpression(ff.options)
          if (!expr) continue
          try {
            const res = evaluateFormula(expr, rowData, fieldOrder)
            const computedVal = res != null ? res : ''
            if (rowData[destKey] !== computedVal) {
              rowData[destKey] = computedVal
              if (computedVal === null || computedVal === undefined) {
                formulaFragments.push(Prisma.sql`${jsonPath}, CAST('null' AS JSON)`)
              } else if (typeof computedVal === 'number') {
                if (Number.isFinite(computedVal)) {
                  formulaFragments.push(Prisma.sql`${jsonPath}, ${computedVal}`)
                } else {
                  formulaFragments.push(Prisma.sql`${jsonPath}, CAST('null' AS JSON)`)
                }
              } else if (typeof computedVal === 'boolean') {
                formulaFragments.push(Prisma.sql`${jsonPath}, CAST(${computedVal ? 'true' : 'false'} AS JSON)`)
              } else if (typeof computedVal === 'object') {
                formulaFragments.push(Prisma.sql`${jsonPath}, CAST(${JSON.stringify(computedVal)} AS JSON)`)
              } else {
                formulaFragments.push(Prisma.sql`${jsonPath}, ${String(computedVal)}`)
              }
              formulaChanged = true
            }
          } catch {
            if (rowData[destKey] !== '#VALUE!') {
              rowData[destKey] = '#VALUE!'
              formulaFragments.push(Prisma.sql`${jsonPath}, ${'#VALUE!'}`)
              formulaChanged = true
            }
          }
        }
        if (formulaChanged && formulaFragments.length > 0) {
          try {
            await prisma.$executeRaw(
              Prisma.sql`UPDATE TableRow SET data = JSON_SET(COALESCE(data, '{}'), ${Prisma.join(formulaFragments, ', ')}), updatedAt = ${now} WHERE id = ${rid} AND tableId = ${tid} AND deletedAt IS NULL`
            )
          } catch (formulaErr) {
            console.warn('[Formula DB Update Warning, falling back to ORM]:', formulaErr)
            await prisma.tableRow.update({
              where: { id: rid },
              data: {
                data: rowData as Prisma.InputJsonValue,
                updatedAt: now,
              },
            }).catch((ormErr) => {
              console.error('[Formula ORM Fallback Failed]:', ormErr)
            })
          }
        }
      }

      // Single-level cascade recomputation
      let affectedRows: any[] = []
      try {
        affectedRows = (await cascadeRecomputeSingleLevel(tid, rid)) || []
      } catch (e) {
        console.warn('[Cascade Recompute Warning]:', e)
      }

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

      // 5. Invalidate Master View Cache for this table
      try {
        await invalidateMasterViewCacheForTable(tid)
      } catch (cacheErr) {
        console.warn('[MasterViewCache Warning on PATCH row]:', cacheErr)
      }

      // 6. Trigger Real-time Pusher Event
      triggerTableEvent(
        tid,
        'row-updated',
        {
          rowId: rid,
          data: rowData,
          affectedRows,
          fieldKey,
          value,
          updatedAt: updatedRow.updatedAt,
        },
        socketId
      )

      return NextResponse.json({ ...updatedRow, data: rowData, affectedRows })
    }

    const updated = await prisma.tableRow.findUnique({
      where: { id: rid },
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

