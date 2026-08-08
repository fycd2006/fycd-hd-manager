import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { evaluateFormula } from '@/lib/formula'
import { authorizeAction } from '@/lib/authorize'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'
import { syncBiDirectionalLinkRow, cleanupRowLinkRowRelations, parseLinkRowIds } from '@/modules/database/services/linkRowSync'
import { getPopulatedTableRows } from '@/modules/database/services/rowQuery'
import { safeJsonParse } from '@/lib/json-utils'

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

    const dbTable = await prisma.databaseTable.findFirst({
      where: { id, deletedAt: null }
    })
    if (!dbTable) {
      return NextResponse.json({ error: '找不到該資料表' }, { status: 404 })
    }

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

    if (result.isPaginated) {
      return NextResponse.json(result.data)
    }

    return NextResponse.json(result.rows)
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
    
    const fields = await prisma.tableField.findMany({ 
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' }
    })
    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)
    
    const rowData = { ...(body.data || {}) }
    fields.forEach(f => {
      const key = `field_${f.id}`
      if (f.type === 'created_by' || f.type === 'last_modified_by') {
        rowData[key] = username
      } else if (f.type === 'created_on' || f.type === 'last_modified_on') {
        rowData[key] = nowStr
      }
    })

    const row = await prisma.$transaction(async (tx) => {
      const autonumberFields = fields.filter(f => f.type === 'autonumber')
      if (autonumberFields.length > 0) {
        const dbTable = await tx.databaseTable.findUnique({ where: { id } })
        if (dbTable && dbTable.autonumberCounter === 0) {
          const existingRows = await tx.tableRow.findMany({
            where: { tableId: id },
            select: { data: true }
          })
          let maxVal = 0
          autonumberFields.forEach(f => {
            const key = `field_${f.id}`
            existingRows.forEach(r => {
              try {
                const parsedData = JSON.parse(r.data || '{}')
                const val = Number(parsedData[key])
                if (!isNaN(val) && val > maxVal) {
                  maxVal = val
                }
              } catch {}
            })
          })
          if (maxVal > 0) {
            await tx.databaseTable.update({ where: { id }, data: { autonumberCounter: maxVal } })
          }
        }

        const updatedTable = await tx.databaseTable.update({
          where: { id },
          data: { autonumberCounter: { increment: 1 } }
        })
        const nextVal = updatedTable.autonumberCounter

        autonumberFields.forEach(f => {
          const key = `field_${f.id}`
          rowData[key] = nextVal
        })
      }

      const maxOrder = await tx.tableRow.aggregate({ where: { tableId: id }, _max: { order: true } })
      return tx.tableRow.create({
        data: {
          tableId: id,
          data: JSON.stringify(rowData),
          order: (maxOrder._max.order ?? 0) + 1,
        },
      })
    }, {
      maxWait: 5000,
      timeout: 10000
    })

    return NextResponse.json({ ...row, data: safeJsonParse(row.data, {}) }, { status: 201 })
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
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const { rowId, data, fieldKey, value } = body
    const rid = parseInt(rowId)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    const currentRow = await prisma.tableRow.findFirst({
      where: { id: rid, tableId: tid, deletedAt: null },
      select: { data: true }
    })
    if (!currentRow) {
      return NextResponse.json({ error: '找不到該資料列' }, { status: 404 })
    }

    const fields = await prisma.tableField.findMany({ 
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' }
    })
    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

    const updateMap: Record<string, any> = { ...(data || {}) }
    if (fieldKey !== undefined) {
      updateMap[fieldKey] = value
    }

    fields.forEach(f => {
      const key = `field_${f.id}`
      if (f.type === 'last_modified_by') {
        updateMap[key] = username
      } else if (f.type === 'last_modified_on') {
        updateMap[key] = nowStr
      }
    })

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

        // Detect link_row field changes to trigger bi-directional synchronization
        const linkRowFields = fields.filter(f => f.type === 'link_row')
        const linkRowSyncTasks: Promise<void>[] = []

        linkRowFields.forEach(f => {
          const key = `field_${f.id}`
          if (key in updateMap) {
            const oldVal = currentData[key]
            const newVal = updateMap[key]

            const oldIds = parseLinkRowIds(oldVal)
            const newIds = parseLinkRowIds(newVal)

            linkRowSyncTasks.push(
              syncBiDirectionalLinkRow(tid, rid, f.id, newIds, oldIds)
            )
          }
        })

        entries.forEach(([k, val]) => {
          currentData[k] = val ?? null
        })

        // Recompute current row formulas dynamically when any cell in row is updated
        const formulaFields = fields.filter(f => f.type === 'formula')
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = ff.options
          if (!expr) return
          if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
            try {
              let parsed = JSON.parse(expr)
              if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed) } catch {}
              }
              if (parsed && typeof parsed === 'object' && parsed.formula) {
                expr = parsed.formula
              }
            } catch {}
          }
          try {
            const fieldOrder = fields.map(f => f.id)
            const res = evaluateFormula(String(expr), currentData, fieldOrder)
            currentData[destKey] = res != null ? String(res) : ''
          } catch {
            currentData[destKey] = '#VALUE!'
          }
        })

        await prisma.tableRow.update({
          where: { id: rid },
          data: {
            data: JSON.stringify(currentData),
            updatedAt: new Date()
          }
        })

        // Execute bi-directional link_row sync tasks asynchronously after row update
        if (linkRowSyncTasks.length > 0) {
          try {
            await Promise.all(linkRowSyncTasks)
          } catch (syncErr) {
            console.warn('[Bi-directional Sync Warning]:', syncErr)
          }
        }
      }

    // Task 3: Single-Level Cascade Recomputation (300 Rows Threshold)
    try {
      await cascadeRecomputeSingleLevel(tid, rid)
    } catch (e) {
      console.warn('[Cascade Recompute Warning]:', e)
    }

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

    // Cleanup bi-directional reverse link references before soft-deleting row
    try {
      await cleanupRowLinkRowRelations(tid, rid)
    } catch (cleanupErr) {
      console.warn('[Link Row Cleanup Warning]:', cleanupErr)
    }

    await prisma.tableRow.update({
      where: { id: rid, tableId: tid },
      data: { deletedAt: new Date() }
    })

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

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < rowOrders.length; index++) {
        const rowId = rowOrders[index]
        await tx.tableRow.update({
          where: { id: rowId, tableId: tid },
          data: { order: index },
        })
      }
    }, {
      maxWait: 5000,
      timeout: 10000
    })

    return NextResponse.json({ message: '資料列順序已儲存' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '儲存資料列順序失敗' }, { status: 500 })
  }
}

