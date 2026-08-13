import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { evaluateFormula, detectCircularDependency, extractFormulaExpression } from '@/lib/formula'

/**
 * Cascade recompute direct dependent rows up to CASCADE_THRESHOLD (300 rows)
 */
export async function cascadeRecomputeSingleLevel(updatedTableId: number, updatedRowId: number) {
  const CASCADE_THRESHOLD = 300

  const relationFields = await prisma.tableField.findMany({
    where: {
      type: { in: ['link_row', 'lookup', 'rollup'] },
      deletedAt: null,
    }
  })

  const dependentTableIds = new Set<number>()
  relationFields.forEach(f => {
    try {
      const opts: any = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
      if (opts.targetTableId === updatedTableId || opts.relationTableId === updatedTableId) {
        dependentTableIds.add(f.tableId)
      }
    } catch {}
  })

  if (dependentTableIds.size === 0) return []

  const candidateRowsRaw = await prisma.$queryRaw<{id: number}[]>`
    SELECT id FROM TableRow
    WHERE tableId IN (${Prisma.join(Array.from(dependentTableIds))})
    AND deletedAt IS NULL
    AND data LIKE ${'%' + String(updatedRowId) + '%'}
  `
  
  const candidateRows = await prisma.tableRow.findMany({
    where: { id: { in: candidateRowsRaw.map(r => r.id) } }
  })

  const affectedRows: { id: number; tableId: number; data: Record<string, any> }[] = []
  candidateRows.forEach(r => {
    try {
      const parsedData: any = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {})
      const isLinked = Object.keys(parsedData).some(key => {
        const val = parsedData[key]
        if (Array.isArray(val)) {
          return val.some(id => Number(id) === updatedRowId)
        }
        return false
      })
      if (isLinked) {
        affectedRows.push({ id: r.id, tableId: r.tableId, data: parsedData })
      }
    } catch {}
  })

  if (affectedRows.length > CASCADE_THRESHOLD) {
    console.warn(`[Cascade Recompute] Exceeded threshold (${affectedRows.length} > ${CASCADE_THRESHOLD}). Skipping synchronous cascade recompute.`)
    return []
  }

  // Pre-fetch all fields for affected dependent tables in a single query (fixes N+1 DB query)
  const allDepFields = await prisma.tableField.findMany({
    where: {
      tableId: { in: Array.from(new Set(affectedRows.map(r => r.tableId))) },
      deletedAt: null,
    },
    orderBy: { order: 'asc' }
  })

  const fieldsByTableId = new Map<number, typeof allDepFields>()
  allDepFields.forEach(f => {
    const list = fieldsByTableId.get(f.tableId) || []
    list.push(f)
    fieldsByTableId.set(f.tableId, list)
  })

  if (affectedRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const depRow of affectedRows) {
        const depFields = fieldsByTableId.get(depRow.tableId) || []
        const depData = { ...depRow.data }
        
        const formulaMap: Record<string, string> = {}
        depFields.forEach(f => {
          if (f.type === 'formula' && f.options) {
             formulaMap[`field_${f.id}`] = extractFormulaExpression(f.options)
          }
        })

        depFields.forEach(f => {
          const key = `field_${f.id}`
          if (f.type === 'formula' && f.options) {
            if (detectCircularDependency(key, formulaMap)) {
              depData[key] = '#CIRCULAR!'
            } else {
              try {
                const expr = extractFormulaExpression(f.options)
                const fieldOrder = depFields.map(f => f.id)
                const res = evaluateFormula(expr, depData, fieldOrder)
                depData[key] = res != null ? String(res) : ''
              } catch {
                depData[key] = '#VALUE!'
              }
            }
          }
        })

        await tx.tableRow.update({
          where: { id: depRow.id },
          data: { data: depData as any }
        })
        depRow.data = depData
      }
    })
  }

  return affectedRows
}

/**
 * Clean up dependent lookup/rollup fields when a field is deleted
 */
export async function cleanupFieldDependencies(deletedFieldId: number) {
  const lookupRollupFields = await prisma.tableField.findMany({
    where: {
      type: { in: ['lookup', 'rollup'] },
      deletedAt: null,
    }
  })

  for (const field of lookupRollupFields) {
    if (!field.options) continue
    try {
      const opts: any = typeof field.options === 'string' ? JSON.parse(field.options) : (field.options || {})
      if (Number(opts.relationFieldId) === deletedFieldId || Number(opts.targetFieldId) === deletedFieldId) {
        const newOpts = {
          ...opts,
          ...(Number(opts.relationFieldId) === deletedFieldId ? { relationFieldId: null } : {}),
          ...(Number(opts.targetFieldId) === deletedFieldId ? { targetFieldId: null } : {}),
        }
        await prisma.tableField.update({
          where: { id: field.id },
          data: { options: newOpts as any }
        })
      }
    } catch {}
  }
}
