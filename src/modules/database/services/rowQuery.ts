import prisma from '@/lib/prisma'
import { evaluateFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'

export interface QueryOptions {
  sortField?: string | null
  sortOrder?: string | null
  filterParam?: string | null
  searchQuery?: string | null
  pageParam?: string | null
  pageSizeParam?: string | null
}

export interface ParsedRow {
  id: number
  tableId: number
  data: Record<string, any>
  order: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export async function getPopulatedTableRows(tableId: number, options: QueryOptions) {
  const { sortField, sortOrder = 'asc', filterParam, searchQuery, pageParam, pageSizeParam } = options

  // 1. Fetch fields to identify special field types
  const fields = await prisma.tableField.findMany({
    where: { tableId, deletedAt: null },
    orderBy: { order: 'asc' }
  })

  const linkRowFields = fields.filter(f => f.type === 'link_row')
  const lookupFields = fields.filter(f => f.type === 'lookup')
  const rollupFields = fields.filter(f => f.type === 'rollup')
  const formulaFields = fields.filter(f => f.type === 'formula')
  const collaboratorFields = fields.filter(f => f.type === 'collaborator')
  const auditFields = fields.filter(f => ['created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

  // Query system users for collaborator name mapping if needed
  const userMap = new Map<number, string>()
  if (collaboratorFields.length > 0) {
    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true }
    })
    allUsers.forEach(u => userMap.set(u.id, u.username))
  }

  // 2. Fetch rows
  let whereCondition: any = { tableId, deletedAt: null }
  if (searchQuery) {
    const sanitized = searchQuery.slice(0, 100).trim()
    if (sanitized) {
      whereCondition = {
        tableId,
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

  // Parse JSON data defensively
  let parsed: ParsedRow[] = rows.map(r => ({ ...r, data: safeJsonParse<Record<string, any>>(r.data, {}) }))

  const parseLinkRowIds = (val: any): number[] => {
    if (val === null || val === undefined) return []
    let list: any[] = []
    if (Array.isArray(val)) {
      list = val
    } else if (typeof val === 'string' && val.trim()) {
      try {
        const parsedJson = JSON.parse(val)
        if (Array.isArray(parsedJson)) list = parsedJson
        else list = [parsedJson]
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

  // 3. Collect all target row IDs from link_row fields
  const targetRowIds = new Set<number>()
  parsed.forEach(row => {
    linkRowFields.forEach(f => {
      const key = `field_${f.id}`
      const ids = parseLinkRowIds(row.data[key])
      ids.forEach(id => targetRowIds.add(id))
    })
  })

  const activeRelationFields: Record<number, { relationFieldId: number; targetFieldId: number; type: string; rollupFunction?: string }> = {}

  lookupFields.forEach(lf => {
    const opts = safeJsonParse(lf.options, {} as any)
    if (opts.relationFieldId && opts.targetFieldId) {
      activeRelationFields[lf.id] = {
        relationFieldId: opts.relationFieldId,
        targetFieldId: opts.targetFieldId,
        type: 'lookup'
      }
    }
  })

  rollupFields.forEach(rf => {
    const opts = safeJsonParse(rf.options, {} as any)
    if (opts.relationFieldId && opts.targetFieldId) {
      activeRelationFields[rf.id] = {
        relationFieldId: opts.relationFieldId,
        targetFieldId: opts.targetFieldId,
        type: 'rollup',
        rollupFunction: opts.rollupFunction || 'sum'
      }
    }
  })

  parsed.forEach(row => {
    Object.values(activeRelationFields).forEach(ref => {
      const key = `field_${ref.relationFieldId}`
      const ids = parseLinkRowIds(row.data[key])
      ids.forEach(id => targetRowIds.add(id))
    })
  })

  // 4. Query target rows in bulk
  const targetRowsMap = new Map<number, Record<string, any>>()
  const targetDisplayMap = new Map<number, string>()

  if (targetRowIds.size > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: Array.from(targetRowIds) }, deletedAt: null },
    })

    const targetTableIds = Array.from(new Set(targetRows.map(tr => tr.tableId)))
    const targetFields = await prisma.tableField.findMany({
      where: { tableId: { in: targetTableIds }, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const targetPrimaryFieldMap = new Map<number, string>()
    targetTableIds.forEach(tid => {
      const tfList = targetFields.filter(f => f.tableId === tid)
      if (tfList.length > 0) {
        targetPrimaryFieldMap.set(tid, `field_${tfList[0].id}`)
      }
    })

    targetRows.forEach(tr => {
      const trData = safeJsonParse<Record<string, any>>(tr.data, {})
      targetRowsMap.set(tr.id, trData)

      const primaryKey = targetPrimaryFieldMap.get(tr.tableId)
      let primaryVal = primaryKey ? trData[primaryKey] : null

      if (primaryVal == null || primaryVal === '') {
        const firstNonEmpty = Object.values(trData).find(v => v != null && v !== '' && typeof v !== 'object')
        primaryVal = firstNonEmpty ?? `列 ID: ${tr.id}`
      }

      targetDisplayMap.set(tr.id, String(primaryVal))
    })
  }

  // 5. Populate values
  parsed = parsed.map(row => {
    const newData = { ...row.data }

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

    Object.entries(activeRelationFields).forEach(([fieldIdStr, ref]) => {
      const destKey = `field_${fieldIdStr}`
      const relationKey = `field_${ref.relationFieldId}`
      const relationIds = parseLinkRowIds(row.data[relationKey])

      const values: any[] = []
      relationIds.forEach(id => {
        const trData = targetRowsMap.get(Number(id))
        if (trData) {
          const targetVal = trData[`field_${ref.targetFieldId}`]
          if (targetVal != null && targetVal !== '') {
            if (Array.isArray(targetVal)) {
              const formatted = targetVal.map(item =>
                typeof item === 'object' && item !== null ? (item.value || item.name || item.username || JSON.stringify(item)) : String(item)
              ).filter(Boolean).join(', ')
              if (formatted) values.push(formatted)
            } else if (typeof targetVal === 'object' && targetVal !== null) {
              values.push(targetVal.value || targetVal.name || targetVal.username || JSON.stringify(targetVal))
            } else {
              values.push(String(targetVal))
            }
          }
        }
      })

      if (ref.type === 'lookup') {
        newData[destKey] = values.join(', ')
      } else if (ref.type === 'rollup') {
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

    formulaFields.forEach(ff => {
      const destKey = `field_${ff.id}`
      let expr = ff.options
      if (!expr) {
        newData[destKey] = ''
        return
      }

      if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
        try {
          let parsedOpts = JSON.parse(expr)
          if (typeof parsedOpts === 'string') {
            try { parsedOpts = JSON.parse(parsedOpts) } catch {}
          }
          if (parsedOpts && typeof parsedOpts === 'object' && parsedOpts.formula) {
            expr = parsedOpts.formula
          }
        } catch {}
      }

      try {
        const fieldOrder = fields.map(f => f.id)
        const result = evaluateFormula(String(expr), newData, fieldOrder)
        newData[destKey] = result != null ? String(result) : ''
      } catch {
        newData[destKey] = '#VALUE!'
      }
    })

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
        case 'last_modified_by': {
          const val = row.data[destKey]
          if (val && typeof val === 'object') {
            newData[destKey] = val.username || val.name || val.label || JSON.stringify(val)
          } else {
            newData[destKey] = val || '系統管理員'
          }
          break
        }
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

  const totalRows = parsed.length

  if (pageSizeParam === 'all') {
    return { rows: parsed, isPaginated: false }
  }

  if (pageParam || pageSizeParam) {
    const page = Math.max(1, parseInt(pageParam || '1'))
    const pageSize = Math.max(1, parseInt(pageSizeParam || '50'))
    const startIndex = (page - 1) * pageSize
    const paginatedRows = parsed.slice(startIndex, startIndex + pageSize)

    return {
      isPaginated: true,
      data: {
        rows: paginatedRows,
        pagination: {
          page,
          pageSize,
          totalRows,
          totalPages: Math.ceil(totalRows / pageSize)
        }
      }
    }
  }

  return { rows: parsed, isPaginated: false }
}
