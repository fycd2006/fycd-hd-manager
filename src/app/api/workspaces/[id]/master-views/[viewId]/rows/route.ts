import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'
import {
  upsertMasterViewOverride,
  revertMasterViewOverride,
  revertBatchMasterViewOverrides,
} from '@/modules/database/services/masterViewOverride'
import { invalidateMasterViewCache } from '@/modules/database/services/masterViewCache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  try {
    const { id, viewId } = await params
    const workspaceId = parseInt(id)
    const masterViewId = parseInt(viewId)

    if (isNaN(workspaceId) || isNaN(masterViewId)) {
      return NextResponse.json({ error: '無效的工作區 ID 或總表視圖 ID' }, { status: 400 })
    }

    // Must have canEditData on the workspace to modify master view overrides
    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canEditData' })
    if (errorResponse) return errorResponse

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const { sourceTableId, sourceRowId, overrides } = body
    const srcTableId = parseInt(sourceTableId)
    const srcRowId = parseInt(sourceRowId)

    if (isNaN(srcTableId) || isNaN(srcRowId)) {
      return NextResponse.json({ error: '缺少有效的 sourceTableId 或 sourceRowId' }, { status: 400 })
    }

    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
      return NextResponse.json({ error: 'overrides 必須為有效的物件格式' }, { status: 400 })
    }

    const result = await upsertMasterViewOverride({
      masterViewId,
      sourceTableId: srcTableId,
      sourceRowId: srcRowId,
      overrides,
    })

    // Invalidate master view cache
    await invalidateMasterViewCache(workspaceId, masterViewId)

    return NextResponse.json({ success: true, override: result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API PATCH /api/workspaces/[id]/master-views/[viewId]/rows Error]:', error)
    return NextResponse.json({ error: msg || '更新總表覆寫欄位失敗' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  try {
    const { id, viewId } = await params
    const workspaceId = parseInt(id)
    const masterViewId = parseInt(viewId)

    if (isNaN(workspaceId) || isNaN(masterViewId)) {
      return NextResponse.json({ error: '無效的工作區 ID 或總表視圖 ID' }, { status: 400 })
    }

    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canEditData' })
    if (errorResponse) return errorResponse

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    // 1. Support Batch Items Deletion: { items: Array<{ sourceTableId, sourceRowId, fieldKey? }> }
    if (Array.isArray(body?.items)) {
      const validItems = body.items
        .map((it: any) => ({
          sourceTableId: parseInt(it?.sourceTableId),
          sourceRowId: parseInt(it?.sourceRowId),
          fieldKey: typeof it?.fieldKey === 'string' && it.fieldKey.trim() ? it.fieldKey.trim() : undefined,
        }))
        .filter((it: any) => !isNaN(it.sourceTableId) && !isNaN(it.sourceRowId))

      if (validItems.length === 0) {
        return NextResponse.json({ error: '缺少有效的 items 批次還原清單' }, { status: 400 })
      }

      const result = await revertBatchMasterViewOverrides(masterViewId, validItems)

      // Invalidate master view cache
      await invalidateMasterViewCache(workspaceId, masterViewId)

      return NextResponse.json({ ...result })
    }

    // 2. Support Single Row/Field Deletion: { sourceTableId, sourceRowId, fieldKey? }
    const { sourceTableId, sourceRowId, fieldKey } = body || {}
    const srcTableId = parseInt(sourceTableId)
    const srcRowId = parseInt(sourceRowId)

    if (isNaN(srcTableId) || isNaN(srcRowId)) {
      return NextResponse.json({ error: '缺少有效的 sourceTableId 或 sourceRowId' }, { status: 400 })
    }

    const result = await revertMasterViewOverride({
      masterViewId,
      sourceTableId: srcTableId,
      sourceRowId: srcRowId,
      fieldKey: fieldKey || undefined,
    })

    // Invalidate master view cache
    await invalidateMasterViewCache(workspaceId, masterViewId)

    return NextResponse.json({ ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API DELETE /api/workspaces/[id]/master-views/[viewId]/rows Error]:', error)
    return NextResponse.json({ error: msg || '還原總表覆寫欄位失敗' }, { status: 500 })
  }
}


