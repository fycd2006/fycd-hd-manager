import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { parseAirtableBasePayload } from '@/lib/airtable/airtableImporter'
import { fetchAirtableSchemaWithToken, extractAirtableId } from '@/lib/airtable/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session) {
      return NextResponse.json({ error: '未認證或會話已逾期' }, { status: 401 })
    }

    const body = await req.json()
    const { shareUrl, token, rawPayload } = body

    let convertedTables

    if (rawPayload) {
      convertedTables = parseAirtableBasePayload(rawPayload)
    } else if (token && shareUrl) {
      const extracted = extractAirtableId(shareUrl)
      if (extracted.type !== 'base') {
        return NextResponse.json({ error: '無效的 Airtable Base ID 或網址' }, { status: 400 })
      }
      const schemaData = await fetchAirtableSchemaWithToken(extracted.id, token)
      convertedTables = parseAirtableBasePayload(schemaData)
    } else {
      return NextResponse.json({ error: '請提供 Airtable 共享網址、Personal Access Token 或 JSON 資料' }, { status: 400 })
    }

    const totalTables = convertedTables.length
    const totalRows = convertedTables.reduce((acc, t) => acc + t.rows.length, 0)

    return NextResponse.json({
      success: true,
      message: `成功從 Airtable 解析 ${totalTables} 個表格與 ${totalRows} 筆紀錄`,
      tables: convertedTables,
      stats: {
        tableCount: totalTables,
        rowCount: totalRows,
      },
    })
  } catch (error: any) {
    console.error('Airtable Import Error:', error)
    return NextResponse.json({ error: error.message || '匯入 Airtable 時發生錯誤' }, { status: 500 })
  }
}
