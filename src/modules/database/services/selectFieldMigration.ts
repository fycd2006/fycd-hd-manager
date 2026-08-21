import prisma from '@/lib/prisma'
import { safeJsonParse } from '@/lib/json-utils'
import { randomUUID } from 'crypto'

export interface FieldMeta {
  id: number
  tableId: number
  type: string
  options: unknown
}

export interface RowMeta {
  id: number
  tableId: number
  data: Record<string, any>
}

const DEFAULT_COLORS = [
  'gray', 'blue', 'green', 'orange', 'red', 'yellow', 'cyan', 'purple', 'pink'
]

/**
 * Migrates single_select / multiple_select legacy text values into UUID choices
 * and updates Row data and Field options accordingly.
 */
export async function migrateSelectFieldsForTable(tableId?: number, fieldId?: number): Promise<{
  fieldsMigrated: number
  rowsMigrated: number
}> {
  const whereField: any = {
    deletedAt: null,
    type: { in: ['single_select', 'multiple_select'] }
  }
  if (tableId) whereField.tableId = tableId
  if (fieldId) whereField.id = fieldId

  const selectFields = await prisma.tableField.findMany({
    where: whereField
  })

  if (selectFields.length === 0) return { fieldsMigrated: 0, rowsMigrated: 0 }

  const targetTableIds = Array.from(new Set(selectFields.map(f => f.tableId)))

  const rows = await prisma.tableRow.findMany({
    where: {
      tableId: { in: targetTableIds },
      deletedAt: null
    }
  })

  if (rows.length === 0) return { fieldsMigrated: 0, rowsMigrated: 0 }

  const fieldUpdates = new Map<number, any>()
  const rowUpdates = new Map<number, Record<string, any>>()

  for (const field of selectFields) {
    const fieldKey = `field_${field.id}`
    let options = typeof field.options === 'string' ? safeJsonParse(field.options, { choices: [] }) : ((field.options as any) || { choices: [] })
    if (!options.choices || !Array.isArray(options.choices)) options.choices = []

    let optionsChanged = false
    const choicesByName = new Map<string, any>()
    const choicesById = new Map<string, any>()

    for (let i = 0; i < options.choices.length; i++) {
      const c = options.choices[i]
      if (typeof c === 'string') {
        const newC = { id: randomUUID(), name: c, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }
        options.choices[i] = newC
        optionsChanged = true
        choicesByName.set(newC.name, newC)
        choicesById.set(newC.id, newC)
      } else if (c && typeof c === 'object') {
        choicesByName.set(c.name, c)
        choicesById.set(c.id, c)
      }
    }

    const tableRows = rows.filter(r => r.tableId === field.tableId)

    for (const row of tableRows) {
      const rowData: Record<string, any> =
        rowUpdates.get(row.id) ||
        (typeof row.data === 'string' ? safeJsonParse(row.data, {}) : (row.data as Record<string, any>) || {})
      const val = rowData[fieldKey]
      if (val == null || val === '') continue

      let rowChanged = false
      let newRowVal: any = null

      if (field.type === 'single_select') {
        const strVal = String(val)
        if (!choicesById.has(strVal)) {
          if (choicesByName.has(strVal)) {
            newRowVal = choicesByName.get(strVal).id
            rowChanged = true
          } else {
            const newChoice = {
              id: randomUUID(),
              name: strVal.trim() || '未命名',
              color: 'gray'
            }
            options.choices.push(newChoice)
            choicesByName.set(newChoice.name, newChoice)
            choicesById.set(newChoice.id, newChoice)
            optionsChanged = true
            newRowVal = newChoice.id
            rowChanged = true
          }
        }
      } else if (field.type === 'multiple_select') {
        let items: string[] = []
        if (Array.isArray(val)) {
          items = val.map(String)
        } else if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) items = parsed.map(String)
            else items = [val]
          } catch {
            items = val.split(',').map(s => s.trim()).filter(Boolean)
          }
        } else {
          items = [String(val)]
        }

        const newItems: string[] = []
        for (const item of items) {
          if (choicesById.has(item)) {
            newItems.push(item)
          } else if (choicesByName.has(item)) {
            newItems.push(choicesByName.get(item).id)
            rowChanged = true
          } else {
            const newChoice = {
              id: randomUUID(),
              name: item.trim() || '未命名',
              color: 'gray'
            }
            options.choices.push(newChoice)
            choicesByName.set(newChoice.name, newChoice)
            choicesById.set(newChoice.id, newChoice)
            optionsChanged = true
            newItems.push(newChoice.id)
            rowChanged = true
          }
        }

        if (rowChanged || typeof val === 'string') {
          newRowVal = JSON.stringify(newItems.length ? newItems : [])
          rowChanged = true
        }
      }

      if (rowChanged) {
        rowData[fieldKey] = newRowVal
        rowUpdates.set(row.id, rowData)
      }
    }

    if (optionsChanged) {
      fieldUpdates.set(field.id, options)
      field.options = options
    }
  }

  // Persist updates
  if (fieldUpdates.size > 0) {
    for (const [fId, newOptions] of fieldUpdates.entries()) {
      await prisma.tableField.update({
        where: { id: fId },
        data: { options: newOptions }
      })
    }
  }

  if (rowUpdates.size > 0) {
    for (const [rId, newData] of rowUpdates.entries()) {
      await prisma.tableRow.update({
        where: { id: rId },
        data: { data: newData }
      })
    }
  }

  return {
    fieldsMigrated: fieldUpdates.size,
    rowsMigrated: rowUpdates.size
  }
}
