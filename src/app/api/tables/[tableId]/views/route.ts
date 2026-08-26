import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler } from '@/lib/api-handler'
import { z } from 'zod'

const createViewSchema = z.object({
  name: z.string().min(1, '視圖名稱與類型為必填'),
  type: z.string().min(1, '視圖名稱與類型為必填'),
})

const updateViewSchema = z.object({
  viewId: z.union([z.number(), z.string()]),
  name: z.string().optional(),
  filters: z.any().optional(),
  sortField: z.string().nullable().optional(),
  sortOrder: z.string().nullable().optional(),
  hiddenFields: z.any().optional(),
  columnWidths: z.any().optional(),
  rowColors: z.any().optional(),
  groupByField: z.string().nullable().optional(),
  aggregations: z.any().optional(),
})

export const GET = withApiHandler<{ tableId: string }>(
  async ({ params }) => {
    const tid = parseInt(params.tableId)
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

    return views
  },
  {
    auth: { action: 'canViewData' },
  }
)

export const POST = withApiHandler<{ tableId: string }, z.infer<typeof createViewSchema>>(
  async ({ params, body }) => {
    const tid = parseInt(params.tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const newView = await prisma.tableView.create({
      data: {
        tableId: tid,
        name: body!.name,
        type: body!.type
      }
    })

    return NextResponse.json(newView, { status: 201 })
  },
  {
    auth: { action: 'canManageViews' },
    bodySchema: createViewSchema,
  }
)

export const PATCH = withApiHandler<{ tableId: string }, z.infer<typeof updateViewSchema>>(
  async ({ params, body }) => {
    const tid = parseInt(params.tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const vid = typeof body!.viewId === 'string' ? parseInt(body!.viewId) : body!.viewId
    if (isNaN(vid)) return NextResponse.json({ error: '無效的 View ID' }, { status: 400 })

    const toJsonString = (val: any) => {
      if (val === undefined || val === null) return null
      return typeof val === 'string' ? val : JSON.stringify(val)
    }

    const { name, filters, sortField, sortOrder, hiddenFields, columnWidths, rowColors, groupByField, aggregations } = body!

    const updated = await prisma.tableView.update({
      where: { id: vid, tableId: tid },
      data: {
        ...(name !== undefined && { name }),
        ...(filters !== undefined && { filters: toJsonString(filters) }),
        ...(sortField !== undefined && { sortField }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(hiddenFields !== undefined && { hiddenFields: toJsonString(hiddenFields) }),
        ...(columnWidths !== undefined && { columnWidths: toJsonString(columnWidths) }),
        ...(rowColors !== undefined && { rowColors: toJsonString(rowColors) }),
        ...(groupByField !== undefined && { groupByField }),
        ...(aggregations !== undefined && { aggregations: toJsonString(aggregations) }),
      }
    })

    return updated
  },
  {
    auth: { action: 'canManageViews' },
    bodySchema: updateViewSchema,
  }
)

export const DELETE = withApiHandler<{ tableId: string }>(
  async ({ request, params }) => {
    const tid = parseInt(params.tableId)
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

    return { message: '視圖已刪除' }
  },
  {
    auth: { action: 'canManageViews' },
  }
)
