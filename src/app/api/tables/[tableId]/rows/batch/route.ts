import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'
import { FieldRegistry } from '@/modules/database/fields/types'
import { evaluateFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'
import { triggerTableEvent } from '@/lib/pusher-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getSessionUsername() {
  const user = await getSessionUser()
  return user?.username || '系統 (System)'
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
    const rows = body.rows
    const socketId = body.socket_id

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '無效的批次資料' }, { status: 400 })
    }

    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

    const parsedRowsData: Array<{ clientId: string, data: string, order: number }> = []

    // Process all rows first before transaction
    for (const rowObj of rows) {
      if (!rowObj.clientId) {
        return NextResponse.json({ error: '批次新增缺少 clientId' }, { status: 400 })
      }

      const rowData: Record<string, any> = {}
      for (const f of fields) {
        const key = `field_${f.id}`
        if (f.type === 'created_by' || f.type === 'last_modified_by') {
          rowData[key] = username
        } else if (f.type === 'created_on' || f.type === 'last_modified_on') {
          rowData[key] = nowStr
        } else if ((rowObj.data && rowObj.data[key] !== undefined) || (rowObj && rowObj[key] !== undefined)) {
          const rawValue = (rowObj.data && rowObj.data[key] !== undefined) ? rowObj.data[key] : rowObj[key]
          let fOpts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
          const fieldType = FieldRegistry.get(f.type)
          const validateRes = fieldType.validateValue(rawValue, fOpts)

          if (!validateRes.valid) {
            return NextResponse.json({ error: `欄位 [${f.name}] 驗證失敗: ${validateRes.error}` }, { status: 400 })
          }
          rowData[key] = validateRes.parsedValue
        } else {
          let fOpts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
          const fieldType = FieldRegistry.get(f.type)
          const def = fieldType.getDefaultValue(fOpts)
          if (def !== null) rowData[key] = def
        }
      }

      const normalizedRowData: Record<string, any> = {}
      Object.entries(rowData).forEach(([k, v]) => {
        const fid = parseInt(k.replace('field_', ''))
        if (!isNaN(fid)) {
          normalizedRowData[`field_${fid}`] = v
        } else {
          normalizedRowData[k] = v
        }
      })

      parsedRowsData.push({
        clientId: rowObj.clientId,
        data: JSON.stringify(normalizedRowData),
        order: 0 // placeholder
      })
    }

    const createdRows = await prisma.$transaction(async (tx) => {
      // Autonumber processing
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
                const parsedData: any = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {})
                const val = Number(parsedData[key])
                if (!isNaN(val) && val > maxVal) {
                  maxVal = val
                }
              } catch { }
            })
          })
          if (maxVal > 0) {
            await tx.databaseTable.update({ where: { id }, data: { autonumberCounter: maxVal } })
          }
        }

        const updatedTable = await tx.databaseTable.update({
          where: { id },
          data: { autonumberCounter: { increment: rows.length } }
        })

        // Start counter before the incremented block
        let currentAutoNumber = updatedTable.autonumberCounter - rows.length + 1

        parsedRowsData.forEach(row => {
          const rowData = JSON.parse(row.data)
          autonumberFields.forEach(f => {
            const key = `field_${f.id}`
            rowData[key] = currentAutoNumber
          })
          row.data = JSON.stringify(rowData)
          currentAutoNumber++
        })
      }

      // Order processing
      const maxOrderResult = await tx.tableRow.aggregate({ where: { tableId: id }, _max: { order: true } })
      let currentOrder = (maxOrderResult._max.order ?? 0) + 1

      parsedRowsData.forEach(row => {
        row.order = currentOrder++
      })

      const insertData = parsedRowsData.map(r => ({
        tableId: id,
        clientId: r.clientId,
        data: r.data,
        order: r.order
      }))

      // Create many
      await tx.tableRow.createMany({
        data: insertData
      })

      // Fetch created rows to return their IDs using clientIds
      const clientIds = insertData.map(r => r.clientId)
      const fetchedRows = await tx.tableRow.findMany({
        where: {
          tableId: id,
          clientId: { in: clientIds }
        },
        orderBy: { order: 'asc' }
      })

      return fetchedRows.map(r => ({
        ...r,
        data: safeJsonParse(r.data, {})
      }))
    }, {
      maxWait: 5000,
      timeout: 20000
    })

    // Batch event
    triggerTableEvent(id, 'rows-batch-changed', { type: 'create', count: createdRows.length }, socketId)

    return NextResponse.json({ rows: createdRows }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '批次新增資料列失敗' }, { status: 500 })
  }
}

export async function DELETE(
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
    const rowIds = body.rowIds
    const socketId = body.socket_id

    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return NextResponse.json({ error: '無效的 ID 列表' }, { status: 400 })
    }

    const numericRowIds = rowIds.map(rid => parseInt(rid)).filter(rid => !isNaN(rid))
    if (numericRowIds.length === 0) {
      return NextResponse.json({ error: '沒有可刪除的有效 ID' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Ensure all rows belong to the table
      const existingRows = await tx.tableRow.findMany({
        where: { id: { in: numericRowIds } },
        select: { id: true, tableId: true }
      })

      const invalidRows = existingRows.filter(r => r.tableId !== id)
      if (invalidRows.length > 0) {
        throw new Error('部分列不存在或無權限')
      }

      await tx.tableRow.updateMany({
        where: { id: { in: numericRowIds } },
        data: { deletedAt: new Date() }
      })
    })

    triggerTableEvent(id, 'rows-batch-changed', { type: 'delete', count: numericRowIds.length }, socketId)

    return NextResponse.json({ success: true, count: numericRowIds.length }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '批次刪除失敗' }, { status: 500 })
  }
}

export async function PATCH(
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
    const updates = body.updates
    const socketId = body.socket_id

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '無效的批次更新資料' }, { status: 400 })
    }

    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' }
    })
    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)
    const validFieldKeys = new Set(fields.map(f => `field_${f.id}`))

    const rowIds = updates.map((u: any) => parseInt(u.rowId)).filter((rid: number) => !isNaN(rid))
    if (rowIds.length === 0) {
      return NextResponse.json({ error: '沒有有效的 Row ID' }, { status: 400 })
    }

    const updatedResults = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.tableRow.findMany({
        where: { id: { in: rowIds }, tableId: id, deletedAt: null }
      })
      const existingRowMap = new Map(existingRows.map(r => [r.id, r]))

      const results: Array<{ rowId: number; beforeData?: Record<string, any>; data: Record<string, any> }> = []

      for (const updateObj of updates) {
        const rid = parseInt(updateObj.rowId)
        if (isNaN(rid)) continue
        const currentRow = existingRowMap.get(rid)
        if (!currentRow) continue

        const dataMap = updateObj.data || {}
        let updateMap: Record<string, any> = { ...dataMap }

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
              throw new Error(`欄位 [${f.name}] 驗證失敗: ${validateRes.error}`)
            }
            updateMap[key] = validateRes.parsedValue
          }
        }

        // 保存更新前的舊值 (beforeData)，供 Pusher 事件與 Undo Stack 使用
        let originalDataObj: Record<string, any> = {}
        if (currentRow.data) {
          try {
            originalDataObj = typeof currentRow.data === 'string' ? JSON.parse(currentRow.data) : currentRow.data
          } catch {
            originalDataObj = {}
          }
        }
        
        let currentData: Record<string, any> = { ...originalDataObj }

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

        Object.entries(updateMap).forEach(([k, val]) => {
          if (/^field_\d+$/.test(k) && validFieldKeys.has(k)) {
            const fid = parseInt(k.replace('field_', ''))
            if (!isNaN(fid)) {
              delete currentData[String(fid)]
              delete currentData[fid]
            }
            currentData[k] = val ?? null
          }
        })

        const formulaFields = fields.filter(f => f.type === 'formula')
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = ff.options
          if (!expr) return
          if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
            try {
              let parsed = JSON.parse(expr)
              if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed) } catch { }
              }
              if (parsed && typeof parsed === 'object' && parsed.formula) {
                expr = parsed.formula
              }
            } catch { }
          }
          try {
            const fieldOrder = fields.map(f => f.id)
            const res = evaluateFormula(expr, currentData, fieldOrder)
            currentData[destKey] = res != null ? String(res) : ''
          } catch {
            currentData[destKey] = '#VALUE!'
          }
        })

        results.push({ rowId: rid, beforeData: originalDataObj, data: currentData })
      }

      if (results.length > 0) {
        // [安全邊界] 以下 SQL 字串內的欄位名 (data, updatedAt, id, tableId) 均為寫死。
        // 未有任何來自外部 (User / Frontend) 的動態變數直接進行字串拼接，
        // 所有動態值 (rowId, data JSON 內容) 均透過 `?` 佔位符交由 Prisma 安全綁定，無 SQL Injection 風險。
        let sql = `UPDATE TableRow SET updatedAt = NOW(), data = CASE id `
        const params: any[] = []

        for (const res of results) {
          sql += `WHEN ? THEN ? `
          params.push(res.rowId, JSON.stringify(res.data))
        }

        sql += `ELSE data END WHERE id IN (${results.map(() => '?').join(', ')}) AND tableId = ?`
        params.push(...results.map(r => r.rowId), id)

        await tx.$executeRawUnsafe(sql, ...params)
      }

      return results
    }, {
      maxWait: 5000,
      timeout: 20000
    })

    triggerTableEvent(id, 'rows-batch-updated', { updates: updatedResults }, socketId)

    return NextResponse.json({ ok: true, updates: updatedResults }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '批次更新失敗' }, { status: 500 })
  }
}
