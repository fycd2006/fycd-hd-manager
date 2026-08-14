import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'

export type LinkRowOperationType = 'view' | 'edit' | 'detach' | 'link_existing'

export interface LinkRowOperationParams {
  operation: LinkRowOperationType
  sourceTableId: number
  targetTableId: number
}

/**
 * Enforces server-side authorization for linked row operations based on the Phase 2.3 security matrix.
 *
 * Rules:
 * 1. 'view': Requires canViewData on targetTableId.
 * 2. 'edit': Requires canEditData on targetTableId (modifying target row itself).
 * 3. 'detach': Requires canEditData on sourceTableId (modifying source row's relation list).
 * 4. 'link_existing': Requires canEditData on sourceTableId AND canViewData on targetTableId (prevents blind linking to secret tables).
 */
export async function authorizeLinkRowOperation(
  params: LinkRowOperationParams
): Promise<{ allowed: boolean; errorResponse?: NextResponse }> {
  const { operation, sourceTableId, targetTableId } = params

  if (operation === 'view') {
    const { errorResponse } = await authorizeAction({ tableId: targetTableId, action: 'canViewData' })
    if (errorResponse) return { allowed: false, errorResponse }
    return { allowed: true }
  }

  if (operation === 'edit') {
    // Requires canEditData on target table
    const { errorResponse } = await authorizeAction({ tableId: targetTableId, action: 'canEditData' })
    if (errorResponse) return { allowed: false, errorResponse }
    return { allowed: true }
  }

  if (operation === 'detach') {
    // Requires canEditData on source table to modify relation field array
    const { errorResponse } = await authorizeAction({ tableId: sourceTableId, action: 'canEditData' })
    if (errorResponse) return { allowed: false, errorResponse }
    return { allowed: true }
  }

  if (operation === 'link_existing') {
    // 1. Must have edit permission on source table
    const { errorResponse: srcErr } = await authorizeAction({ tableId: sourceTableId, action: 'canEditData' })
    if (srcErr) return { allowed: false, errorResponse: srcErr }

    // 2. Must have at least read permission on target table (prevent blind linking)
    const { errorResponse: targetErr } = await authorizeAction({ tableId: targetTableId, action: 'canViewData' })
    if (targetErr) {
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          { error: '權限不足：無法關聯無讀取權限之目標資料表' },
          { status: 403 }
        ),
      }
    }

    return { allowed: true }
  }

  return {
    allowed: false,
    errorResponse: NextResponse.json({ error: '未知的關聯操作' }, { status: 400 }),
  }
}
