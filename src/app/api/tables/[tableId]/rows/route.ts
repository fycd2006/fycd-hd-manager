import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getSessionUser } from '@/lib/auth'
import { evaluateFormula } from '@/lib/formula'
import { authorizeAction } from '@/lib/authorize'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'
import { syncBiDirectionalLinkRow, cleanupRowLinkRowRelations, parseLinkRowIds } from '@/modules/database/services/linkRowSync'

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

    const { searchParams } = new URL(request.url)
    const sortField = searchParams.get('sort')
    const sortOrder = searchParams.get('order') || 'asc'
    const filterParam = searchParams.get('filter')
    const searchQuery = searchParams.get('search')?.trim()

    // 1. Fetch fields to identify link_row, lookup, and rollup fields
    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const linkRowFields = fields.filter(f => f.type === 'link_row')
    const lookupFields = fields.filter(f => f.type === 'lookup')
    const rollupFields = fields.filter(f => f.type === 'rollup')
    const formulaFields = fields.filter(f => f.type === 'formula')
    const collaboratorFields = fields.filter(f => f.type === 'collaborator')
    const auditFields = fields.filter(f => ['created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

    // Query system users for collaborator name mapping (only if collaborator fields exist)
    const userMap = new Map<number, string>()
    if (collaboratorFields.length > 0) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, username: true }
      })
      allUsers.forEach(u => userMap.set(u.id, u.username))
    }

    // 2. Fetch rows (with server-side DB search across table fields)
    let whereCondition: any = { tableId: id, deletedAt: null }
    if (searchQuery) {
      const sanitized = searchQuery.slice(0, 100).trim()
      if (sanitized) {
        whereCondition = {
          tableId: id,
          deletedAt: null,
          data: {
            contains: sanitized
          }
        }
      }
    }

    const rows = await prisma.tableRow.findMany({
      where: whereCondition,
      orderBy: { order: 'asc' },
    })

    // Parse JSON data
    let parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data || '{}') }))

    // Helper to safely parse target row IDs from link_row values in any format
    const parseLinkRowIds = (val: any): number[] => {
      if (val === null || val === undefined) return []
      let list: any[] = []
      if (Array.isArray(val)) {
        list = val
      } else if (typeof val === 'string' && val.trim()) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) list = parsed
          else list = [parsed]
        } catch {
          list = val.split(',').map(s => s.trim()).filter(Boolean)
        }
      } else {
        list = [val]
      }
      return list.map(item => {
        if (typeof item === 'object' && item !== null) {
          return Number(item.id)
        }
        return Number(item)
      }).filter(n => !isNaN(n) && n > 0)
    }

    // 3. Collect all target row IDs from link_row fields to query them in bulk
    const targetRowIds = new Set<number>()
    parsed.forEach(row => {
      linkRowFields.forEach(f => {
        const key = `field_${f.id}`
        const ids = parseLinkRowIds(row.data[key])
        ids.forEach(id => targetRowIds.add(id))
      })
    })

    // We also need target rows for lookup/rollup evaluation
    // Let's check which relation fields are referenced by lookup/rollup fields
    const activeRelationFields: Record<number, { relationFieldId: number; targetFieldId: number; type: string; rollupFunction?: string }> = {}
    
    lookupFields.forEach(lf => {
      try {
        const opts = lf.options ? JSON.parse(lf.options) : {}
        if (opts.relationFieldId && opts.targetFieldId) {
          activeRelationFields[lf.id] = {
            relationFieldId: opts.relationFieldId,
            targetFieldId: opts.targetFieldId,
            type: 'lookup'
          }
        }
      } catch (e) {}
    })

    rollupFields.forEach(rf => {
      try {
        const opts = rf.options ? JSON.parse(rf.options) : {}
        if (opts.relationFieldId && opts.targetFieldId) {
          activeRelationFields[rf.id] = {
            relationFieldId: opts.relationFieldId,
            targetFieldId: opts.targetFieldId,
            type: 'rollup',
            rollupFunction: opts.rollupFunction || 'sum'
          }
        }
      } catch (e) {}
    })

    // Add targetRowIds for any relation list in lookup/rollup
    parsed.forEach(row => {
      Object.values(activeRelationFields).forEach(ref => {
        const key = `field_${ref.relationFieldId}`
        const ids = parseLinkRowIds(row.data[key])
        ids.forEach(id => targetRowIds.add(id))
      })
    })

    // 4. Query all referenced target rows in bulk
    let targetRowsMap = new Map<number, Record<string, any>>()
    let targetDisplayMap = new Map<number, string>()

    if (targetRowIds.size > 0) {
      const targetRows = await prisma.tableRow.findMany({
        where: { id: { in: Array.from(targetRowIds) }, deletedAt: null },
      })

      // Fetch fields of all referenced target tables to accurately determine their Primary Field (min order)
      const targetTableIds = Array.from(new Set(targetRows.map(tr => tr.tableId)))
      const targetFields = await prisma.tableField.findMany({
        where: { tableId: { in: targetTableIds }, deletedAt: null },
        orderBy: { order: 'asc' }
      })

      // Map targetTableId -> primaryFieldKey (e.g. field_12)
      const targetPrimaryFieldMap = new Map<number, string>()
      targetTableIds.forEach(tid => {
        const tfList = targetFields.filter(f => f.tableId === tid)
        if (tfList.length > 0) {
          targetPrimaryFieldMap.set(tid, `field_${tfList[0].id}`)
        }
      })

      targetRows.forEach(tr => {
        try {
          const trData = JSON.parse(tr.data || '{}')
          targetRowsMap.set(tr.id, trData)
          
          const primaryKey = targetPrimaryFieldMap.get(tr.tableId)
          let primaryVal = primaryKey ? trData[primaryKey] : null

          // Fallback if primary value is empty: search other text values before falling back to row ID
          if (primaryVal == null || primaryVal === '') {
            const firstNonEmpty = Object.values(trData).find(v => v != null && v !== '' && typeof v !== 'object')
            primaryVal = firstNonEmpty ?? `列 ID: ${tr.id}`
          }

          targetDisplayMap.set(tr.id, String(primaryVal))
        } catch {
          targetDisplayMap.set(tr.id, `列 ID: ${tr.id}`)
        }
      })
    }

    // 5. Populate and compute final values (link_row, lookup, rollup)
    parsed = parsed.map(row => {
      const newData = { ...row.data }

      // A. Populate link_row display structures
      linkRowFields.forEach(f => {
        const key = `field_${f.id}`
        const val = newData[key]
        const ids = parseLinkRowIds(val)
        newData[key] = ids.map(id => {
          const displayLabel = targetDisplayMap.get(id)
          let existingLabel = ''
          if (Array.isArray(val)) {
            const foundObj = val.find((item: any) => typeof item === 'object' && item !== null && Number(item.id) === id)
            if (foundObj && foundObj.value && !String(foundObj.value).startsWith('列 ID:')) {
              existingLabel = String(foundObj.value)
            }
          }
          const finalLabel = (displayLabel && !displayLabel.startsWith('列 ID:')) ? displayLabel : (existingLabel || displayLabel || `列 ID: ${id}`)
          return {
            id,
            value: finalLabel
          }
        })
      })
      // C. Populate collaborator display structures
      collaboratorFields.forEach(f => {
        const key = `field_${f.id}`
        const val = newData[key]
        let list: number[] = []
        if (Array.isArray(val)) {
          list = val.map(item => {
            if (typeof item === 'object' && item !== null && 'id' in item) {
              return Number(item.id)
            }
            return Number(item)
          }).filter(n => !isNaN(n))
        } else if (typeof val === 'string' && val.trim()) {
          try {
            const parsedList = JSON.parse(val)
            if (Array.isArray(parsedList)) {
              list = parsedList.map((item: any) => {
                if (typeof item === 'object' && item !== null && 'id' in item) {
                  return Number(item.id)
                }
                return Number(item)
              }).filter(n => !isNaN(n))
            } else {
              list = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            }
          } catch {
            list = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
          }
        } else if (typeof val === 'number') {
          list = [val]
        }
        
        newData[key] = list.map(uid => ({
          id: uid,
          username: userMap.get(uid) || `用戶 ID: ${uid}`
        }))
      })

      // B. Compute Lookup & Rollup columns
      Object.entries(activeRelationFields).forEach(([fieldIdStr, ref]) => {
        const destKey = `field_${fieldIdStr}`
        const relationKey = `field_${ref.relationFieldId}`
        
        // Raw array of target row IDs
        // Note: row.data has the original raw list, newData has the populated list of objects
        const rawRelationIds = row.data[relationKey]
        const relationIds = Array.isArray(rawRelationIds) ? rawRelationIds : []

        // Extract values of the target column from target rows
        const values: any[] = []
        relationIds.forEach(id => {
          const trData = targetRowsMap.get(Number(id))
          if (trData) {
            const targetVal = trData[`field_${ref.targetFieldId}`]
            if (targetVal != null && targetVal !== '') {
              values.push(targetVal)
            }
          }
        })

        if (ref.type === 'lookup') {
          // Lookup returns a list of values
          newData[destKey] = values.join(', ')
        } else if (ref.type === 'rollup') {
          // Rollup aggregates the list of numeric values
          const numValues = values.map(Number).filter(n => !isNaN(n))
          if (numValues.length === 0) {
            newData[destKey] = 0
            return
          }

          if (ref.rollupFunction === 'sum') {
            newData[destKey] = numValues.reduce((a, b) => a + b, 0)
          } else if (ref.rollupFunction === 'count') {
            newData[destKey] = numValues.length
          } else if (ref.rollupFunction === 'average') {
            newData[destKey] = numValues.reduce((a, b) => a + b, 0) / numValues.length
          } else {
            newData[destKey] = 0
          }
        }
      })

      // D. Compute Formulas dynamically (Safe AST Evaluation)
      formulaFields.forEach(ff => {
        const destKey = `field_${ff.id}`
        let expr = ff.options // options holds formula string or JSON object
        if (!expr) {
          newData[destKey] = ''
          return
        }

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
          const result = evaluateFormula(String(expr), newData, fieldOrder)
          newData[destKey] = result != null ? String(result) : ''
        } catch (e) {
          newData[destKey] = '#VALUE!'
        }
      })

      // E. Populate Audit Auto-fields dynamically
      auditFields.forEach(af => {
        const destKey = `field_${af.id}`
        const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
        
        switch (af.type) {
          case 'created_on':
            newData[destKey] = new Date(row.createdAt).toLocaleDateString('zh-TW', dateOpt)
            break
          case 'last_modified_on':
            newData[destKey] = new Date(row.updatedAt).toLocaleDateString('zh-TW', dateOpt)
            break
          case 'created_by':
            newData[destKey] = row.data[destKey] || '系統管理員'
            break
          case 'last_modified_by':
            newData[destKey] = row.data[destKey] || '系統管理員'
            break
        }
      })

      return { ...row, data: newData }
    })

    // Apply filters
    if (filterParam) {
      const parts = filterParam.split(':')
      if (parts.length >= 3) {
        const [fieldKey, operator, ...rest] = parts
        const filterValue = rest.join(':')
        parsed = parsed.filter(row => {
          const cellValue = String(row.data[fieldKey] ?? '')
          switch (operator) {
            case 'contains': return cellValue.toLowerCase().includes(filterValue.toLowerCase())
            case 'not_contains': return !cellValue.toLowerCase().includes(filterValue.toLowerCase())
            case 'equals': return cellValue === filterValue
            case 'not_equals': return cellValue !== filterValue
            case 'higher_than': return !isNaN(Number(cellValue)) && Number(cellValue) > Number(filterValue)
            case 'higher_than_or_equal': return !isNaN(Number(cellValue)) && Number(cellValue) >= Number(filterValue)
            case 'lower_than': return !isNaN(Number(cellValue)) && Number(cellValue) < Number(filterValue)
            case 'lower_than_or_equal': return !isNaN(Number(cellValue)) && Number(cellValue) <= Number(filterValue)
            case 'date_equal': {
              const d1 = new Date(cellValue).getTime()
              const d2 = new Date(filterValue).getTime()
              return !isNaN(d1) && !isNaN(d2) && new Date(d1).toDateString() === new Date(d2).toDateString()
            }
            case 'date_before': {
              const d1 = new Date(cellValue).getTime()
              const d2 = new Date(filterValue).getTime()
              return !isNaN(d1) && !isNaN(d2) && d1 < d2
            }
            case 'date_after': {
              const d1 = new Date(cellValue).getTime()
              const d2 = new Date(filterValue).getTime()
              return !isNaN(d1) && !isNaN(d2) && d1 > d2
            }
            case 'not_empty': return cellValue !== '' && cellValue !== 'null' && cellValue !== 'undefined'
            case 'empty': return cellValue === '' || cellValue === 'null' || cellValue === 'undefined'
            default: return true
          }
        })
      }
    }

    // Apply sort
    if (sortField) {
      parsed.sort((a, b) => {
        const va = a.data[sortField] ?? ''
        const vb = b.data[sortField] ?? ''
        const numA = Number(va)
        const numB = Number(vb)
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortOrder === 'asc' ? numA - numB : numB - numA
        }
        return sortOrder === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      })
    }

    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')
    const totalRows = parsed.length

    if (pageSizeParam === 'all') {
      return NextResponse.json(parsed)
    }

    if (pageParam || pageSizeParam) {
      const page = Math.max(1, parseInt(pageParam || '1'))
      const pageSize = Math.max(1, parseInt(pageSizeParam || '50'))
      const startIndex = (page - 1) * pageSize
      const paginatedRows = parsed.slice(startIndex, startIndex + pageSize)

      return NextResponse.json({
        rows: paginatedRows,
        pagination: {
          page,
          pageSize,
          totalRows,
          totalPages: Math.ceil(totalRows / pageSize)
        }
      })
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢資料列失敗' }, { status: 500 })
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

    return NextResponse.json({ ...row, data: JSON.parse(row.data || '{}') }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '新增資料列失敗' }, { status: 500 })
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

    const body = await request.json()
    const { rowId, data, fieldKey, value } = body
    const rid = parseInt(rowId)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

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
      const currentRow = await prisma.tableRow.findFirst({
        where: { id: rid, tableId: tid, deletedAt: null },
        select: { data: true }
      })
      if (currentRow) {
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

    return NextResponse.json({ ...updated, data: JSON.parse(updated.data || '{}') })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新資料列失敗' }, { status: 500 })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除資料列失敗' }, { status: 500 })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '儲存資料列順序失敗' }, { status: 500 })
  }
}

