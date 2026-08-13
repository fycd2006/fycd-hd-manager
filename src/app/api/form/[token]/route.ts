import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createTableRow, FORM_READONLY_TYPES } from '@/modules/database/services/createRow'
import { applyRateLimit } from '@/lib/rate-limiter'
import { triggerTableEvent } from '@/lib/pusher-server'

export const dynamic = 'force-dynamic'

const READONLY = new Set<string>(FORM_READONLY_TYPES)

async function findFormContext(token: string) {
  // Tokens are 24 random bytes in base64url; reject malformed input early
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null

  const view = await prisma.tableView.findFirst({
    where: { shareToken: token, type: 'form' }
  })
  if (!view) return null

  const table = await prisma.databaseTable.findFirst({
    where: { id: view.tableId, deletedAt: null }
  })
  if (!table) return null

  return { view, table }
}

/**
 * GET (public): return the form schema for a shared form view —
 * table name plus writable fields only. No row data is exposed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const ctx = await findFormContext(token)
    if (!ctx) {
      return NextResponse.json({ error: '表單連結無效或已停用' }, { status: 404 })
    }

    const fields = await prisma.tableField.findMany({
      where: { tableId: ctx.table.id, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const writableFields = fields
      .filter(f => !READONLY.has(f.type))
      .map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: f.options ?? null,
        order: f.order
      }))

    return NextResponse.json({
      tableName: ctx.table.name,
      viewName: ctx.view.name,
      fields: writableFields
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '載入表單失敗' }, { status: 500 })
  }
}

/**
 * POST (public): submit a new row through a shared form view.
 * Only writable field types are accepted; everything else is ignored.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`form:${ip}`, 10, 60)
    if (rateLimitError) return rateLimitError

    const ctx = await findFormContext(token)
    if (!ctx) {
      return NextResponse.json({ error: '表單連結無效或已停用' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const input = (body && typeof body.data === 'object' && body.data !== null) ? body.data : {}

    const result = await createTableRow({
      tableId: ctx.table.id,
      input,
      username: '表單提交 (Form)',
      fieldFilter: (f) => !READONLY.has(f.type)
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    triggerTableEvent(ctx.table.id, 'row-created', { row: result.row })

    // Do not echo the created row back to anonymous submitters
    return NextResponse.json({ message: '提交成功' }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '提交表單失敗' }, { status: 500 })
  }
}
