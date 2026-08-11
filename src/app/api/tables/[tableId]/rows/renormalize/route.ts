import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canEditData' })
    if (errorResponse) return errorResponse

    const rows = await prisma.tableRow.findMany({
      where: { tableId: id },
      orderBy: { order: 'asc' },
      select: { id: true }
    })

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        await tx.tableRow.update({
          where: { id: rows[i].id },
          data: { order: (i + 1) * 1000 }
        })
      }
    })

    return NextResponse.json({ success: true, count: rows.length })
  } catch (error: any) {
    console.error('[API POST /api/tables/[tableId]/rows/renormalize Error]:', error)
    return NextResponse.json({ error: error.message || '重整排序失敗' }, { status: 500 })
  }
}
