import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { parseAirtableBasePayload } from '@/lib/airtable/airtableImporter'
import { fetchAirtableSchemaWithToken, extractAirtableId } from '@/lib/airtable/auth'
import { fetchAllTablesFromSharedLink } from '@/lib/airtable/airtableScraper'
import { authorizeAction } from '@/lib/authorize'
import { prepareBatchCellWrites, mergeChoicesIntoOptions, type FieldMeta } from '@/modules/database/services/cellWrite'
import { FieldRegistry } from '@/modules/database/fields/types'
import type { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
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

    // Persist to Database via Prisma transaction/sequential calls
    const db = await prisma.database.create({
      data: {
        name: baseName,
        workspaceId: parseInt(workspaceId, 10),
      },
    })

    for (let tableIdx = 0; tableIdx < convertedTables.length; tableIdx++) {
      const convertedTable = convertedTables[tableIdx]
      const dbTable = await prisma.databaseTable.create({
        data: {
          name: convertedTable.name || '未命名表格',
          databaseId: db.id,
          order: tableIdx,
        },
      })

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
            options: f.options ? (f.options as any) : null,
          },
        })
        fieldMap.set(f.name, dbField.id)
        fieldMetas.push({ id: dbField.id, name: f.name, type: f.type, options: f.options ?? null })
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
        await prisma.tableRow.create({
          data: {
            tableId: dbTable.id,
            data: { ...row.data, ...readOnlyValues.get(row.key) } as Prisma.InputJsonValue,
            order: row.key,
          },
        })
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
  } catch (error: any) {
    console.error('Airtable Import Error:', error?.message, error?.stack)
    return NextResponse.json({ error: error.message || '匯入 Airtable 時發生錯誤' }, { status: 500 })
  }
}


