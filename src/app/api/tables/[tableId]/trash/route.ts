import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: list all soft-deleted items (fields, rows) of the table
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const deletedFields = await prisma.tableField.findMany({
      where: { tableId: tid, NOT: { deletedAt: null } },
      orderBy: { createdAt: 'desc' }
    })

    const deletedRows = await prisma.tableRow.findMany({
      where: { tableId: tid, NOT: { deletedAt: null } },
      orderBy: { updatedAt: 'desc' }
    })

    const parsedRows = deletedRows.map(r => ({
      ...r,
      data: JSON.parse(r.data || '{}')
    }))

    return NextResponse.json({
      fields: deletedFields,
      rows: parsedRows
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '載入回收站失敗' }, { status: 500 })
  }
}

// POST: restore a soft-deleted item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const body = await request.json()
    const { type, id } = body
    const targetId = parseInt(id)
    if (isNaN(targetId)) return NextResponse.json({ error: '無效的目標 ID' }, { status: 400 })

    if (type === 'field') {
      await prisma.tableField.update({
        where: { id: targetId, tableId: tid },
        data: { deletedAt: null }
      })
    } else if (type === 'row') {
      await prisma.tableRow.update({
        where: { id: targetId, tableId: tid },
        data: { deletedAt: null }
      })
    } else {
      return NextResponse.json({ error: '無效的類型' }, { status: 400 })
    }

    return NextResponse.json({ message: '還原成功' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '還原項目失敗' }, { status: 500 })
  }
}

// DELETE: permanently delete an item (hard delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const idStr = searchParams.get('id')
    const targetId = parseInt(idStr || '')

    if (isNaN(targetId)) return NextResponse.json({ error: '無效的目標 ID' }, { status: 400 })

    if (type === 'field') {
      await prisma.tableField.delete({
        where: { id: targetId, tableId: tid }
      })
    } else if (type === 'row') {
      await prisma.tableRow.delete({
        where: { id: targetId, tableId: tid }
      })
    } else {
      return NextResponse.json({ error: '無效的類型' }, { status: 400 })
    }

    return NextResponse.json({ message: '永久刪除成功' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '永久刪除失敗' }, { status: 500 })
  }
}
