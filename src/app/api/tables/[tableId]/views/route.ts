import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    let views = await prisma.tableView.findMany({
      where: { tableId: tid },
      orderBy: { createdAt: 'asc' }
    })

    // If no views exist for this table, auto-create a default grid view
    if (views.length === 0) {
      const defaultView = await prisma.tableView.create({
        data: {
          tableId: tid,
          name: '預設表格視圖',
          type: 'grid'
        }
      })
      views = [defaultView]
    }

    return NextResponse.json(views)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢視圖失敗' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const body = await request.json()
    const { name, type } = body

    if (!name || !type) {
      return NextResponse.json({ error: '視圖名稱與類型為必填' }, { status: 400 })
    }

    const newView = await prisma.tableView.create({
      data: {
        tableId: tid,
        name,
        type
      }
    })

    return NextResponse.json(newView, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '建立視圖失敗' }, { status: 500 })
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
    const { viewId, name, filters, sortField, sortOrder, hiddenFields, columnWidths, rowColors } = body
    const vid = parseInt(viewId)
    if (isNaN(vid)) return NextResponse.json({ error: '無效的 View ID' }, { status: 400 })

    const updated = await prisma.tableView.update({
      where: { id: vid, tableId: tid },
      data: {
        ...(name && { name }),
        ...(filters !== undefined && { filters: filters ? JSON.stringify(filters) : null }),
        ...(sortField !== undefined && { sortField }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(hiddenFields !== undefined && { hiddenFields: hiddenFields ? JSON.stringify(hiddenFields) : null }),
        ...(columnWidths !== undefined && { columnWidths: columnWidths ? JSON.stringify(columnWidths) : null }),
        ...(rowColors !== undefined && { rowColors: rowColors ? JSON.stringify(rowColors) : null }),
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新視圖失敗' }, { status: 500 })
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
    const viewIdStr = searchParams.get('viewId')
    if (!viewIdStr) return NextResponse.json({ error: '缺少 viewId 參數' }, { status: 400 })

    const vid = parseInt(viewIdStr)
    if (isNaN(vid)) return NextResponse.json({ error: '無效的 View ID' }, { status: 400 })

    // Prevent deleting if it is the only view left
    const count = await prisma.tableView.count({ where: { tableId: tid } })
    if (count <= 1) {
      return NextResponse.json({ error: '無法刪除唯一的視圖，必須保留至少一個' }, { status: 400 })
    }

    await prisma.tableView.delete({
      where: { id: vid, tableId: tid }
    })

    return NextResponse.json({ message: '視圖已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除視圖失敗' }, { status: 500 })
  }
}
