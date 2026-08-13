import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'
import { FieldRegistry } from '@/modules/database/fields/types'
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
    const targetTableId = parseInt(tableId)
    if (isNaN(targetTableId)) return NextResponse.json({ error: '無效的目標 Table ID' }, { status: 400 })

    const { errorResponse: targetAuthErr } = await authorizeAction({ tableId: targetTableId, action: 'canEditData' })
    if (targetAuthErr) return targetAuthErr

    const body = await request.json()
    const { sourceTableId, rows, socket_id } = body
    const sourceTableIdNum = parseInt(sourceTableId)
    
    if (isNaN(sourceTableIdNum)) {
      return NextResponse.json({ error: '無效的來源 Table ID' }, { status: 400 })
    }

    const { errorResponse: sourceAuthErr } = await authorizeAction({ tableId: sourceTableIdNum, action: 'canEditData' })
    if (sourceAuthErr) return sourceAuthErr

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '無效的移動資料' }, { status: 400 })
    }

    // Step 1: Compare Schemas
    const [sourceFields, targetFields] = await Promise.all([
      prisma.tableField.findMany({ where: { tableId: sourceTableIdNum, deletedAt: null }, orderBy: { order: 'asc' } }),
      prisma.tableField.findMany({ where: { tableId: targetTableId, deletedAt: null }, orderBy: { order: 'asc' } })
    ])

    if (sourceTableIdNum !== targetTableId) {
      if (sourceFields.length !== targetFields.length) {
        return NextResponse.json({ error: '來源與目標表格的欄位數量不一致，無法搬移' }, { status: 400 })
      }
      
      const mismatchedFields: string[] = []
      for (let i = 0; i < sourceFields.length; i++) {
        const s = sourceFields[i]
        const t = targetFields[i]
        if (s.name !== t.name || s.type !== t.type) {
          mismatchedFields.push(`${s.name} (${s.type}) vs ${t.name} (${t.type})`)
        }
      }

      if (mismatchedFields.length > 0) {
        return NextResponse.json({ error: `來源與目標表格的欄位結構不一致：${mismatchedFields.join(', ')}` }, { status: 400 })
      }
    }

    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

    const parsedRowsData: Array<{ clientId: string, data: Record<string, any>, order: number, sourceRowId: number }> = []

    // Step 2: Validate Data
    // Note: In cross-table move, field mapping is index-based because IDs might be different.
    for (const rowObj of rows) {
      if (!rowObj.clientId || !rowObj.sourceRowId) {
        return NextResponse.json({ error: '移動資料缺少 clientId 或 sourceRowId' }, { status: 400 })
      }
      
      const rowData: Record<string, any> = {}
      for (let i = 0; i < targetFields.length; i++) {
        const targetF = targetFields[i]
        const sourceF = sourceFields[i]
        const targetKey = `field_${targetF.id}`
        const sourceKey = `field_${sourceF.id}`
        
        if (targetF.type === 'created_by' || targetF.type === 'last_modified_by') {
          rowData[targetKey] = username
        } else if (targetF.type === 'created_on' || targetF.type === 'last_modified_on') {
          rowData[targetKey] = nowStr
        } else if ((rowObj.data && rowObj.data[sourceKey] !== undefined) || (rowObj && rowObj[sourceKey] !== undefined)) {
          const rawValue = (rowObj.data && rowObj.data[sourceKey] !== undefined) ? rowObj.data[sourceKey] : rowObj[sourceKey]
          let fOpts = typeof targetF.options === 'string' ? JSON.parse(targetF.options) : (targetF.options || {})
          const fieldType = FieldRegistry.get(targetF.type)
          const validateRes = fieldType.validateValue(rawValue, fOpts)
          
          if (!validateRes.valid) {
            return NextResponse.json({ error: `欄位 [${targetF.name}] 驗證失敗: ${validateRes.error}` }, { status: 400 })
          }
          rowData[targetKey] = validateRes.parsedValue
        } else {
          let fOpts = typeof targetF.options === 'string' ? JSON.parse(targetF.options) : (targetF.options || {})
          const fieldType = FieldRegistry.get(targetF.type)
          const def = fieldType.getDefaultValue(fOpts)
          if (def !== null) rowData[targetKey] = def
        }
      }

      parsedRowsData.push({
        clientId: rowObj.clientId,
        data: rowData,
        order: typeof rowObj.order === 'number' ? rowObj.order : 0,
        sourceRowId: rowObj.sourceRowId
      })
    }

    // Step 3: Insert Target and Delete Source (Sequential)
    const user = await getSessionUser()
    const userId = user?.id || 0

    // Compute max order for fallbacks
    const maxOrderResult = await prisma.tableRow.aggregate({ where: { tableId: targetTableId }, _max: { order: true } })
    let currentOrder = (maxOrderResult._max.order ?? 0) + 1000

    const createdRows = await prisma.$transaction(async (tx) => {
      // Autonumber processing
      const autonumberFields = targetFields.filter(f => f.type === 'autonumber')
      if (autonumberFields.length > 0) {
        const dbTable = await tx.databaseTable.findUnique({ where: { id: targetTableId } })
        if (dbTable && dbTable.autonumberCounter === 0) {
          const existingRows = await tx.tableRow.findMany({
            where: { tableId: targetTableId },
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
              } catch {}
            })
          })
          if (maxVal > 0) {
            await tx.databaseTable.update({ where: { id: targetTableId }, data: { autonumberCounter: maxVal } })
          }
        }

        const updatedTable = await tx.databaseTable.update({
          where: { id: targetTableId },
          data: { autonumberCounter: { increment: rows.length } }
        })
        
        let currentAutoNumber = updatedTable.autonumberCounter - rows.length + 1
        
        parsedRowsData.forEach(row => {
          autonumberFields.forEach(f => {
            const key = `field_${f.id}`
            row.data[key] = currentAutoNumber
          })
          currentAutoNumber++
        })
      }
      
      const toCreate = parsedRowsData.map(r => {
        let orderToUse = r.order
        if (orderToUse === 0) {
          orderToUse = currentOrder
          currentOrder += 1000
        }
        return {
          tableId: targetTableId,
          clientId: r.clientId,
          data: r.data,
          order: orderToUse,
        }
      })
      
      await tx.tableRow.createMany({ data: toCreate })

      // Retrieve created rows by clientId
      const clientIds = parsedRowsData.map(r => r.clientId)
      return tx.tableRow.findMany({
        where: {
          tableId: targetTableId,
          clientId: { in: clientIds }
        }
      })
    })

    // Notify target
    triggerTableEvent(targetTableId, 'rows-batch-changed', {
      source: socket_id,
      timestamp: Date.now()
    }, socket_id)

    // Step 4: Delete source rows sequentially
    for (const row of parsedRowsData) {
      try {
        await prisma.tableRow.delete({ where: { id: row.sourceRowId } })
      } catch (err) {
        // Fallback: log to MoveOperationLog
        await prisma.moveOperationLog.create({
          data: {
            userId,
            sourceTableId: sourceTableIdNum,
            targetTableId,
            rowId: row.sourceRowId,
            status: 'pending'
          }
        })
      }
    }

    if (sourceTableIdNum !== targetTableId) {
      triggerTableEvent(sourceTableIdNum, 'rows-batch-changed', {
        source: socket_id,
        timestamp: Date.now()
      }, socket_id)
    }

    return NextResponse.json({ success: true, createdRows })
  } catch (error: any) {
    console.error('[API POST /api/tables/[tableId]/rows/move Error]:', error)
    return NextResponse.json({ error: error.message || '移動資料失敗' }, { status: 500 })
  }
}
