import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { getRolePermissions } from '@/lib/permissions'
import type { TrashEntry } from '@/modules/database/types'

const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_DAYS = 30

function daysLeft(deletedAt: Date, now: number): number {
  return Math.max(0, RETENTION_DAYS - Math.floor((now - deletedAt.getTime()) / DAY_MS))
}

// GET: 列出使用者可還原的「最近刪除」項目
export async function GET() {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const isSystemAdmin = activeUser.role === 'admin'
    const workspaces = await prisma.workspace.findMany({
      where: isSystemAdmin ? {} : { members: { some: { userId: activeUser.id } } },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        members: { where: { userId: activeUser.id }, select: { role: true } },
        databases: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
            tables: { select: { id: true, name: true, deletedAt: true } },
          },
        },
      },
    })

    const now = Date.now()
    const items: TrashEntry[] = []

    for (const ws of workspaces) {
      const role = isSystemAdmin ? 'admin' : ws.members[0]?.role
      const perms = getRolePermissions(role)

      if (ws.deletedAt) {
        if (perms.canManageWorkspace) {
          items.push({
            type: 'workspace', id: ws.id, name: ws.name, parentName: null,
            deletedAt: ws.deletedAt.toISOString(), daysLeft: daysLeft(ws.deletedAt, now),
          })
        }
        continue
      }
      if (!perms.canManageStructure) continue

      for (const db of ws.databases) {
        if (db.deletedAt) {
          items.push({
            type: 'database', id: db.id, name: db.name, parentName: ws.name,
            deletedAt: db.deletedAt.toISOString(), daysLeft: daysLeft(db.deletedAt, now),
          })
          continue
        }
        for (const table of db.tables) {
          if (!table.deletedAt) continue
          items.push({
            type: 'table', id: table.id, name: table.name, parentName: db.name,
            deletedAt: table.deletedAt.toISOString(), daysLeft: daysLeft(table.deletedAt, now),
          })
        }
      }
    }

    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || '載入最近刪除失敗' }, { status: 500 })
  }
}
