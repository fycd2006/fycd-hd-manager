import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { parseAirtableBasePayload } from '@/lib/airtable/airtableImporter'
import { fetchAirtableSchemaWithToken, extractAirtableId } from '@/lib/airtable/auth'
import { fetchAllTablesFromSharedLink } from '@/lib/airtable/airtableScraper'
import { authorizeAction } from '@/lib/authorize'
import { prepareBatchCellWrites, mergeChoicesIntoOptions, type FieldMeta } from '@/modules/database/services/cellWrite'
import { FieldRegistry } from '@/modules/database/fields/FieldRegistry'
import { normalizeRowData } from '@/modules/database/utils/normalizeRowData'
import { Prisma } from '@prisma/client'

interface LinkRowMeta {
  dbFieldId: number
  dbTableId: number
  airtableTableId: string
  airtableFieldId: string
  linkedAirtableTableId?: string
}

interface LinkRowRawItem {
  dbRowId: number
  dbFieldId: number
  rawAirtableVal: unknown
}

export async function POST(req: NextRequest) {
  let createdDbId: number | null = null

  try {
    const session = await getSessionUser()
    if (!session) {
      return NextResponse.json({ error: '未認證或會話已逾期' }, { status: 401 })
    }

    const body = await req.json()
    const { shareUrl, token, rawPayload, workspaceId } = body

    if (!workspaceId) {
      return NextResponse.json({ error: '請提供工作區 ID' }, { status: 400 })
    }

    // Check workspace permissions
    const { errorResponse } = await authorizeAction({
      workspaceId: parseInt(workspaceId, 10),
      action: 'canManageStructure',
    })
    if (errorResponse) return errorResponse

    let convertedTables
    let baseName = 'Airtable 匯入'

    if (rawPayload) {
      convertedTables = parseAirtableBasePayload(rawPayload)
      if (rawPayload.name) {
        baseName = rawPayload.name
      }
    } else if (token && shareUrl) {
      const extracted = extractAirtableId(shareUrl)
      if (extracted.type !== 'base') {
        return NextResponse.json({ error: '無效的 Airtable Base ID 或網址' }, { status: 400 })
      }
      const schemaData = await fetchAirtableSchemaWithToken(extracted.id, token)
      convertedTables = parseAirtableBasePayload(schemaData)
      baseName = `Airtable 匯入 (${extracted.id})`
    } else if (shareUrl && !token) {
      // Shared link import — scrape the public page (same approach as Baserow)
      const payload = await fetchAllTablesFromSharedLink(shareUrl)
      convertedTables = parseAirtableBasePayload(payload)
      if (payload.name) {
        baseName = payload.name
      }
    } else {
      return NextResponse.json({ error: '請提供 Airtable 共享網址、Personal Access Token 或 JSON 資料' }, { status: 400 })
    }

    let rejectedCellCount = 0

    // Persist to Database via Prisma
    const db = await prisma.database.create({
      data: {
        name: baseName,
        workspaceId: parseInt(workspaceId, 10),
      },
    })
    createdDbId = db.id

    // Cross-table ID mappings for two-pass relational link resolution
    const airtableTableIdToDbTableId = new Map<string, number>()
    const airtableRowIdToDbRowId = new Map<string, number>()
    const linkRowFields: LinkRowMeta[] = []
    const linkRowRawValues: LinkRowRawItem[] = []

    for (let tableIdx = 0; tableIdx < convertedTables.length; tableIdx++) {
      const convertedTable = convertedTables[tableIdx]
      const dbTable = await prisma.databaseTable.create({
        data: {
          name: convertedTable.name || '未命名表格',
          databaseId: db.id,
          order: tableIdx,
        },
      })
      if (convertedTable.airtableId) {
        airtableTableIdToDbTableId.set(convertedTable.airtableId, dbTable.id)
      }

      // Create TableFields and build mapping
      const fieldMap = new Map<string, number>()
      const fieldMetas: FieldMeta[] = []
      for (let colIdx = 0; colIdx < convertedTable.fields.length; colIdx++) {
        const f = convertedTable.fields[colIdx]
        const dbField = await prisma.tableField.create({
          data: {
            tableId: dbTable.id,
            name: f.name,
            type: f.type,
            order: colIdx,
            options: f.options ? (f.options as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        })
        fieldMap.set(f.name, dbField.id)
        fieldMetas.push({ id: dbField.id, name: f.name, type: f.type, options: f.options ?? null })

        if (f.type === 'link_row') {
          const opts = (f.options && typeof f.options === 'object' ? f.options : {}) as Record<string, unknown>
          linkRowFields.push({
            dbFieldId: dbField.id,
            dbTableId: dbTable.id,
            airtableTableId: convertedTable.airtableId,
            airtableFieldId: f.airtableId,
            linkedAirtableTableId: typeof opts.linkedTableId === 'string' ? opts.linkedTableId : undefined,
          })
        }
      }

      // Imported history: values of read-only fields (formula, autonumber, created_on...) are copied as-is;
      // only writable fields are validated, and invalid cells are skipped
      const readOnlyIds = new Set(fieldMetas.filter(m => FieldRegistry.get(m.type).readOnly).map(m => m.id))
      const readOnlyValues = new Map<number, Record<string, unknown>>()
      const prepared = prepareBatchCellWrites({
        fields: fieldMetas.filter(m => !readOnlyIds.has(m.id)),
        rows: convertedTable.rows.map((r, rowIdx) => {
          const input: Record<string, unknown> = {}
          const copied: Record<string, unknown> = {}
          for (const [fieldName, val] of Object.entries(r.data)) {
            const ourFieldId = fieldMap.get(fieldName)
            if (!ourFieldId) continue
            if (readOnlyIds.has(ourFieldId)) copied[`field_${ourFieldId}`] = val
            else input[`field_${ourFieldId}`] = val
          }
          readOnlyValues.set(rowIdx, copied)
          return { key: rowIdx, input }
        }),
        mode: 'create',
        canAddOptions: true,
        actor: { username: session.username },
      })

      // The fields were created just above, so new select choices go straight into their options
      for (const [fieldIdStr, choices] of Object.entries(prepared.optionAdditions)) {
        const fieldId = Number(fieldIdStr)
        const meta = fieldMetas.find(m => m.id === fieldId)
        if (!meta || choices.length === 0) continue
        await prisma.tableField.update({
          where: { id: fieldId },
          data: { options: mergeChoicesIntoOptions(meta.options, choices) as Prisma.InputJsonValue },
        })
      }

      // Create TableRows
      for (const row of prepared.rows) {
        rejectedCellCount += row.rejected.length
        const dbRow = await prisma.tableRow.create({
          data: {
            tableId: dbTable.id,
            data: { ...row.data, ...readOnlyValues.get(row.key) } as Prisma.InputJsonValue,
            order: row.key,
          },
        })

        const convertedRow = convertedTable.rows[row.key]
        if (dbRow && dbRow.id && convertedRow && convertedRow.airtableId) {
          airtableRowIdToDbRowId.set(convertedRow.airtableId, dbRow.id)
        }

        // Track raw foreign key data for link_row fields on this row
        if (dbRow && dbRow.id && convertedRow && convertedRow.rawCellValuesByFieldId) {
          for (const lf of convertedTable.fields) {
            if (lf.type === 'link_row' && lf.airtableId) {
              const rawVal = convertedRow.rawCellValuesByFieldId[lf.airtableId] ?? convertedRow.rawCellValuesByFieldId[lf.name]
              if (rawVal !== undefined && rawVal !== null) {
                const dbFieldId = fieldMap.get(lf.name)
                if (dbFieldId) {
                  linkRowRawValues.push({
                    dbRowId: dbRow.id,
                    dbFieldId,
                    rawAirtableVal: rawVal,
                  })
                }
              }
            }
          }
        }
      }

      // Create default grid view
      await prisma.tableView.create({
        data: {
          tableId: dbTable.id,
          name: '全部資料',
          type: 'grid',
        },
      })
    }

    // ── Phase 2: Bi-directional link_row options & record backfilling ───
    // 1. Update link_row field options (targetTableId & relatedFieldId)
    for (const lf of linkRowFields) {
      if (lf.linkedAirtableTableId) {
        const targetTableId = airtableTableIdToDbTableId.get(lf.linkedAirtableTableId)
        if (targetTableId) {
          // Exclude self to avoid self-referencing reverse loop
          const targetLinkFields = linkRowFields.filter(f => f.dbTableId === targetTableId && f.dbFieldId !== lf.dbFieldId)
          // Match reverse field only if unambiguous (exactly 1 candidate)
          const matchingReverseFields = targetLinkFields.filter(f => f.linkedAirtableTableId === lf.airtableTableId)
          const reverseField = matchingReverseFields.length === 1 ? matchingReverseFields[0] : undefined

          const fieldOpts: Record<string, unknown> = {
            targetTableId,
            ...(reverseField ? { relatedFieldId: reverseField.dbFieldId } : {}),
          }

          await prisma.tableField.update({
            where: { id: lf.dbFieldId },
            data: {
              options: fieldOpts as Prisma.InputJsonValue,
            },
          })
        }
      }
    }

    // 2. Update link_row cells with real target dbRow IDs
    const linkUpdatesByRowId = new Map<number, Record<string, unknown>>()
    for (const item of linkRowRawValues) {
      const raw = item.rawAirtableVal
      let rawItems: unknown[] = []
      if (Array.isArray(raw)) {
        rawItems = raw
      } else if (raw && typeof raw === 'object') {
        rawItems = [raw]
      } else if (typeof raw === 'string') {
        rawItems = [raw]
      }

      const resolvedLinks: Array<{ id: number; value: string }> = []
      for (const rItem of rawItems) {
        let foreignRecId: string | null = null
        let displayName: string | null = null

        if (rItem && typeof rItem === 'object') {
          const obj = rItem as Record<string, unknown>
          foreignRecId = (obj.foreignRowId as string) ?? (obj.id as string) ?? null
          displayName = (obj.foreignRowDisplayName as string) ?? (obj.name as string) ?? (obj.value as string) ?? null
        } else if (typeof rItem === 'string') {
          foreignRecId = rItem
        }

        if (foreignRecId && airtableRowIdToDbRowId.has(foreignRecId)) {
          const targetDbRowId = airtableRowIdToDbRowId.get(foreignRecId)
          if (targetDbRowId) {
            resolvedLinks.push({
              id: targetDbRowId,
              value: displayName ? String(displayName) : `列 ID: ${targetDbRowId}`,
            })
          }
        }
      }

      if (resolvedLinks.length > 0) {
        const existing = linkUpdatesByRowId.get(item.dbRowId) || {}
        existing[`field_${item.dbFieldId}`] = resolvedLinks
        linkUpdatesByRowId.set(item.dbRowId, existing)
      }
    }

    for (const [rowId, fieldUpdates] of linkUpdatesByRowId.entries()) {
      const existingRow = await prisma.tableRow.findUnique({
        where: { id: rowId },
        select: { data: true },
      })
      if (existingRow) {
        const currentData = typeof existingRow.data === 'string'
          ? JSON.parse(existingRow.data)
          : ((existingRow.data as Record<string, unknown>) || {})

        const mergedData = normalizeRowData({ ...currentData, ...fieldUpdates })
        await prisma.tableRow.update({
          where: { id: rowId },
          data: {
            data: mergedData as Prisma.InputJsonValue,
          },
        })
      }
    }

    const totalTables = convertedTables.length
    const totalRows = convertedTables.reduce((acc, t) => acc + t.rows.length, 0)

    return NextResponse.json({
      success: true,
      message: `成功從 Airtable 解析並匯入 ${totalTables} 個表格與 ${totalRows} 筆紀錄`,
      tables: convertedTables,
      stats: {
        tableCount: totalTables,
        rowCount: totalRows,
        rejectedCellCount,
      },
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Airtable Import Error:', err?.message, err?.stack)

    // Rollback / clean up partial database on failure
    if (createdDbId) {
      try {
        const tables = await prisma.databaseTable.findMany({ where: { databaseId: createdDbId } })
        const tableIds = tables.map(t => t.id)
        if (tableIds.length > 0) {
          await prisma.tableRow.deleteMany({ where: { tableId: { in: tableIds } } })
          await prisma.tableView.deleteMany({ where: { tableId: { in: tableIds } } })
          await prisma.tableField.deleteMany({ where: { tableId: { in: tableIds } } })
          await prisma.databaseTable.deleteMany({ where: { id: { in: tableIds } } })
        }
        await prisma.database.delete({ where: { id: createdDbId } })
      } catch (cleanupErr) {
        console.error('Failed to cleanup partial database on import error:', cleanupErr)
      }
    }

    return NextResponse.json({ error: err?.message || '匯入 Airtable 時發生錯誤' }, { status: 500 })
  }
}
