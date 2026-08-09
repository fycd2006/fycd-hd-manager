import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { evaluateFormula } from '@/lib/formula'
import { authorizeAction } from '@/lib/authorize'
import { triggerTableEvent } from '@/lib/pusher-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getSessionUsername() {
  const user = await getSessionUser()
  return user?.username || '系統 (System)'
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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const { updates, socket_id: socketId } = body
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '缺少更新資料列陣列' }, { status: 400 })
    }

    const fields = await prisma.tableField.findMany({
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const username = await getSessionUsername()
    const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)
    const validFieldKeys = new Set(fields.map(f => `field_${f.id}`))

    const rowIds = updates.map(u => Number(u.rowId)).filter(id => !isNaN(id))
    const existingRows = await prisma.tableRow.findMany({
      where: { id: { in: rowIds }, tableId: tid, deletedAt: null },
      select: { id: true, data: true }
    })
    const existingRowMap = new Map(existingRows.map(r => [r.id, r.data]))

    const processedUpdates: Array<{ rowId: number; data: Record<string, any> }> = []

    for (const update of updates) {
      const rid = Number(update.rowId)
      if (isNaN(rid) || !existingRowMap.has(rid)) continue

      const rawData = existingRowMap.get(rid)
      let currentData: Record<string, any> = {}
      if (rawData) {
        try {
          currentData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
        } catch {
          currentData = {}
        }
      }

      const inputMap: Record<string, any> = update.data || {}
      fields.forEach(f => {
        const key = `field_${f.id}`
        if (f.type === 'last_modified_by') {
          inputMap[key] = username
        } else if (f.type === 'last_modified_on') {
          inputMap[key] = nowStr
        }
      })

      // Normalize currentData: migrate legacy numeric keys and purge stale numeric keys
      const normalizedData: Record<string, any> = {}
      Object.entries(currentData).forEach(([k, v]) => {
        const fid = parseInt(k.replace('field_', ''))
        if (!isNaN(fid) && validFieldKeys.has(`field_${fid}`)) {
          normalizedData[`field_${fid}`] = v
        } else if (/^field_\d+$/.test(k)) {
          normalizedData[k] = v
        }
      })
      currentData = normalizedData

      Object.entries(inputMap).forEach(([k, val]) => {
        if (/^field_\d+$/.test(k) && validFieldKeys.has(k)) {
          const fid = parseInt(k.replace('field_', ''))
          if (!isNaN(fid)) {
            delete currentData[String(fid)]
            delete currentData[fid]
          }
          currentData[k] = val ?? null
        }
      })

      // Recompute formulas
      const formulaFields = fields.filter(f => f.type === 'formula')
      formulaFields.forEach(ff => {
        const destKey = `field_${ff.id}`
        let expr = ff.options
        if (!expr) return
        if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
          try {
            let parsed = JSON.parse(expr)
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed) } catch {} }
            if (parsed && typeof parsed === 'object' && parsed.formula) expr = parsed.formula
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

      processedUpdates.push({ rowId: rid, data: currentData })
    }

    // Execute bulk update in 1 single transaction
    await prisma.$transaction(
      processedUpdates.map(u =>
        prisma.tableRow.update({
          where: { id: u.rowId },
          data: {
            data: JSON.stringify(u.data),
            updatedAt: new Date()
          }
        })
      )
    )

    triggerTableEvent(tid, 'rows-batch-updated', { updates: processedUpdates }, socketId)

    return NextResponse.json({ ok: true, updates: processedUpdates })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || '批次更新資料列失敗' }, { status: 500 })
  }
}
