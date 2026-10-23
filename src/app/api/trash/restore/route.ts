import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'
import {
  restoreWorkspace,
  restoreDatabase,
  restoreTable,
} from '@/modules/database/services/containerTrash'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'

// POST: 還原最近刪除的工作區、資料庫或資料表
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, id } = body
    const targetId = parseInt(id)
    if (isNaN(targetId)) return NextResponse.json({ error: '無效的目標 ID' }, { status: 400 })

    let result
    if (type === 'workspace') {
      const { errorResponse } = await authorizeAction({
        workspaceId: targetId, action: 'canManageWorkspace', includeDeleted: true,
      })
      if (errorResponse) return errorResponse
      result = await restoreWorkspace(targetId)
    } else if (type === 'database') {
      const { errorResponse } = await authorizeAction({
        databaseId: targetId, action: 'canManageStructure', includeDeleted: true,
      })
      if (errorResponse) return errorResponse
      result = await restoreDatabase(targetId)
    } else if (type === 'table') {
      const { errorResponse } = await authorizeAction({
        tableId: targetId, action: 'canManageStructure', includeDeleted: true,
      })
      if (errorResponse) return errorResponse
      result = await restoreTable(targetId)
    } else {
      return NextResponse.json({ error: '無效的類型' }, { status: 400 })
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    for (const tableId of result.tableIds) {
      try {
        await invalidateMasterViewCacheForTable(tableId)
      } catch (cacheErr) {
        console.warn('[MasterViewCache Warning on trash restore]:', cacheErr)
      }
    }

    return NextResponse.json({ message: '還原成功' })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || '還原項目失敗' }, { status: 500 })
  }
}
