import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    // Basic auth check for Vercel Cron Header
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 })
    }

    const RETENTION_DAYS = 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

    console.log(`[Cron Trash Cleanup] Starting cleanup for items deleted before ${cutoffDate.toISOString()}`)

    // 1. Delete rows soft-deleted > 30 days
    const deletedRowsResult = await prisma.tableRow.deleteMany({
      where: {
        deletedAt: {
          lte: cutoffDate,
          not: null,
        },
      },
    })

    // 2. Delete tables soft-deleted > 30 days
    const deletedTablesResult = await prisma.databaseTable.deleteMany({
      where: {
        deletedAt: {
          lte: cutoffDate,
          not: null,
        },
      },
    })

    // 3. Delete fields soft-deleted > 30 days
    const deletedFieldsResult = await prisma.tableField.deleteMany({
      where: {
        deletedAt: {
          lte: cutoffDate,
          not: null,
        },
      },
    })

    const summary = {
      message: 'Trash cleanup completed successfully',
      deletedRows: deletedRowsResult.count,
      deletedTables: deletedTablesResult.count,
      deletedFields: deletedFieldsResult.count,
      retentionDays: RETENTION_DAYS,
      executedAt: new Date().toISOString(),
    }

    console.log(`[Cron Trash Cleanup] Success:`, summary)
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error(`[Cron Trash Cleanup] Error:`, error)
    return NextResponse.json(
      { error: error.message || 'Trash cleanup failed', executedAt: new Date().toISOString() },
      { status: 500 }
    )
  }
}
