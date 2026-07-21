import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { parseFormula, evaluateFormula } from '@/lib/formula'

async function getSessionUsername() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session?.value) return '系統 (System)'
    const decoded = Buffer.from(session.value, 'base64').toString('utf-8')
    const user = JSON.parse(decoded)
    return user.username || '系統 (System)'
  } catch {
    return '系統 (System)'
  }
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

    // 1. Fetch fields to identify link_row, lookup, and rollup fields
    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
    })

    const linkRowFields = fields.filter(f => f.type === 'link_row')
    const lookupFields = fields.filter(f => f.type === 'lookup')
    const rollupFields = fields.filter(f => f.type === 'rollup')
    const formulaFields = fields.filter(f => f.type === 'formula')
    const collaboratorFields = fields.filter(f => f.type === 'collaborator')
    const auditFields = fields.filter(f => ['created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

    // Query all system users for collaborator name mapping
    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true }
    })
    const userMap = new Map<number, string>(allUsers.map(u => [u.id, u.username]))

    // 2. Fetch rows
    const rows = await prisma.tableRow.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' },
    })

    // Parse JSON data
    let parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data || '{}') }))

    // 3. Collect all target row IDs from link_row fields to query them in bulk
    const targetRowIds = new Set<number>()
    parsed.forEach(row => {
      linkRowFields.forEach(f => {
        const key = `field_${f.id}`
        const val = row.data[key]
        if (Array.isArray(val)) {
          val.forEach(id => {
            const numId = Number(id)
            if (!isNaN(numId)) targetRowIds.add(numId)
          })
        }
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
        const val = row.data[key]
        if (Array.isArray(val)) {
          val.forEach(id => {
            const numId = Number(id)
            if (!isNaN(numId)) targetRowIds.add(numId)
          })
        }
      })
    })

    // 4. Query all referenced target rows in bulk
    let targetRowsMap = new Map<number, Record<string, any>>()
    let targetDisplayMap = new Map<number, string>()

    if (targetRowIds.size > 0) {
      const targetRows = await prisma.tableRow.findMany({
        where: { id: { in: Array.from(targetRowIds) }, deletedAt: null },
      })

      targetRows.forEach(tr => {
        try {
          const trData = JSON.parse(tr.data || '{}')
          targetRowsMap.set(tr.id, trData)
          
          const firstKey = Object.keys(trData)[0]
          const firstVal = firstKey ? trData[firstKey] : ''
          targetDisplayMap.set(tr.id, String(firstVal || `列 ID: ${tr.id}`))
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
        if (Array.isArray(val)) {
          newData[key] = val
            .filter(id => targetDisplayMap.has(Number(id)))
            .map(id => ({
              id,
              value: targetDisplayMap.get(Number(id)) || `列 ID: ${id}`
            }))
        } else {
          newData[key] = []
        }
      })
      // C. Populate collaborator display structures
      collaboratorFields.forEach(f => {
        const key = `field_${f.id}`
        const val = newData[key]
        let list: number[] = []
        if (Array.isArray(val)) {
          list = val.map(Number).filter(n => !isNaN(n))
        } else if (typeof val === 'string' && val.trim()) {
          try {
            const parsedList = JSON.parse(val)
            if (Array.isArray(parsedList)) {
              list = parsedList.map(Number).filter(n => !isNaN(n))
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
        const expr = ff.options // options holds formula string
        if (!expr) {
          newData[destKey] = ''
          return
        }

        try {
          const ast = parseFormula(expr)
          const result = evaluateFormula(ast, newData)
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
            case 'equals': return cellValue === filterValue
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
    const body = await request.json()
    
    const fields = await prisma.tableField.findMany({ where: { tableId: id } })
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

    // Compute Autonumbers for the table
    const autonumberFields = fields.filter(f => f.type === 'autonumber')
    if (autonumberFields.length > 0) {
      const existingRows = await prisma.tableRow.findMany({
        where: { tableId: id },
        select: { data: true }
      })
      
      autonumberFields.forEach(f => {
        const key = `field_${f.id}`
        let maxVal = 0
        existingRows.forEach(r => {
          try {
            const parsedData = JSON.parse(r.data || '{}')
            const val = Number(parsedData[key])
            if (!isNaN(val) && val > maxVal) {
              maxVal = val
            }
          } catch {}
        })
        rowData[key] = maxVal + 1
      })
    }

    const maxOrder = await prisma.tableRow.aggregate({ where: { tableId: id }, _max: { order: true } })
    const row = await prisma.tableRow.create({
      data: {
        tableId: id,
        data: JSON.stringify(rowData),
        order: (maxOrder._max.order ?? 0) + 1,
      },
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

    const body = await request.json()
    const { rowId, data } = body
    const rid = parseInt(rowId)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    // Merge new field values into existing data
    const existing = await prisma.tableRow.findFirst({
      where: { id: rid, tableId: tid }
    })
    if (!existing) return NextResponse.json({ error: '找不到該列' }, { status: 404 })

    const fields = await prisma.tableField.findMany({ where: { tableId: tid } })
    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

    const existingData = JSON.parse(existing.data || '{}')
    const mergedData = { ...existingData, ...data }

    fields.forEach(f => {
      const key = `field_${f.id}`
      if (f.type === 'last_modified_by') {
        mergedData[key] = username
      } else if (f.type === 'last_modified_on') {
        mergedData[key] = nowStr
      }
    })

    const updated = await prisma.tableRow.update({
      where: { id: rid },
      data: { data: JSON.stringify(mergedData) },
    })

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

    const { searchParams } = new URL(request.url)
    const rowIdStr = searchParams.get('rowId')
    if (!rowIdStr) return NextResponse.json({ error: '缺少 rowId 參數' }, { status: 400 })
    
    const rid = parseInt(rowIdStr)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    await prisma.tableRow.update({
      where: { id: rid, tableId: tid },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ message: '資料列已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除資料列失敗' }, { status: 500 })
  }
}

