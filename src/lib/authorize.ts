import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser, SessionUser } from '@/lib/auth'
import { getRolePermissions, RolePermissions } from '@/lib/permissions'
import { getCache, setCache } from '@/lib/redis'

export interface AuthorizationResult {
  user: SessionUser
  role: string
  permissions: RolePermissions
  workspaceId: number
}

/**
 * Verifies that the logged-in user has permission for a specific action in a workspace.
 * If workspaceId is not given directly, resolves workspaceId via tableId or databaseId.
 */
export async function authorizeAction(
  options: {
    workspaceId?: number
    databaseId?: number
    tableId?: number
    action: keyof RolePermissions
  }
): Promise<{ errorResponse?: NextResponse; auth?: AuthorizationResult }> {
  const user = await getSessionUser()
  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }
  }

  let resolvedWorkspaceId = options.workspaceId

  // Resolve via tableId if workspaceId not provided
  if (!resolvedWorkspaceId && options.tableId) {
    const table = await prisma.databaseTable.findFirst({
      where: { id: options.tableId, deletedAt: null },
      include: { database: true }
    })
    if (table?.database?.workspaceId) {
      resolvedWorkspaceId = table.database.workspaceId
    } else {
      return {
        errorResponse: NextResponse.json({ error: '找不到對應的資料表' }, { status: 404 })
      }
    }
  }

  // Resolve via databaseId if workspaceId not provided
  if (!resolvedWorkspaceId && options.databaseId) {
    const db = await prisma.database.findUnique({
      where: { id: options.databaseId }
    })
    if (db?.workspaceId) {
      resolvedWorkspaceId = db.workspaceId
    }
  }

  if (!resolvedWorkspaceId) {
    return {
      errorResponse: NextResponse.json({ error: '無法找到對應的工作區' }, { status: 400 })
    }
  }

  // Fetch user role in workspace with Redis cache
  const cacheKey = `ws_role:${resolvedWorkspaceId}:${user.id}`
  let roleStr = await getCache<string>(cacheKey)

  if (!roleStr) {
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: resolvedWorkspaceId,
          userId: user.id
        }
      }
    })

    if (!workspaceUser && user.role !== 'admin') {
      return {
        errorResponse: NextResponse.json(
          { error: '權限不足：您未加入此工作區，無法存取或執行操作' },
          { status: 403 }
        )
      }
    }

    roleStr = workspaceUser?.role || (user.role === 'admin' ? 'admin' : 'viewer')
    await setCache(cacheKey, roleStr, 60)
  }

  const role = roleStr!
  const permissions = getRolePermissions(role)

  const hasPermission = Boolean(permissions[options.action])
  if (!hasPermission) {
    return {
      errorResponse: NextResponse.json(
        { error: `權限不足：您的角色「${role}」無法執行此操作` },
        { status: 403 }
      )
    }
  }

  return {
    auth: {
      user,
      role,
      permissions,
      workspaceId: resolvedWorkspaceId
    }
  }
}

/**
 * Invalidates the cached workspace role for a specific user.
 * Call this when a user's role is updated or user is removed from a workspace.
 */
export async function invalidateWorkspaceRoleCache(workspaceId: number, userId: number): Promise<void> {
  const { delCache } = await import('@/lib/redis')
  const cacheKey = `ws_role:${workspaceId}:${userId}`
  await delCache(cacheKey)
}

