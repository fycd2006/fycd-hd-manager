import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'

// GET: 載入所有的工作區 ➔ 資料庫 ➔ 資料表結構 (需要登入)
export async function GET() {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const workspaceWhere = activeUser.role === 'admin' 
      ? {} 
      : { members: { some: { userId: activeUser.id } } }

    let workspaces = await prisma.workspace.findMany({
      where: workspaceWhere,
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, email: true } }
          }
        },
        databases: {
          include: {
            tables: {
              where: { deletedAt: null },
              orderBy: { order: 'asc' },
              include: {
                _count: { select: { rows: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (workspaces.length === 0) {
      await prisma.workspace.create({
        data: {
          name: `${activeUser.username || '個人'} 的工作區`,
          databases: {
            create: {
              name: '預設資料庫'
            }
          },
          members: {
            create: {
              userId: activeUser.id,
              role: 'admin',
              twoFactor: false
            }
          }
        }
      })
      workspaces = await prisma.workspace.findMany({
        where: workspaceWhere,
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, email: true } }
            }
          },
          databases: {
            include: {
              tables: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
                include: {
                  _count: { select: { rows: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    }

    const defaultDb = workspaces[0].databases[0]
    const orphanTables = await prisma.databaseTable.findMany({
      where: { databaseId: null }
    })

    if (orphanTables.length > 0 && defaultDb) {
      await prisma.databaseTable.updateMany({
        where: { id: { in: orphanTables.map(t => t.id) } },
        data: { databaseId: defaultDb.id }
      })

      workspaces = await prisma.workspace.findMany({
        where: workspaceWhere,
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, email: true } }
            }
          },
          databases: {
            include: {
              tables: {
                orderBy: { order: 'asc' },
                include: {
                  _count: { select: { rows: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    }

    return NextResponse.json(workspaces)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '載入工作區失敗' }, { status: 500 })
  }
}

// POST: 建立工作區、資料庫或歸屬資料表 (需要權限過濾)
export async function POST(request: Request) {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { action, name, workspaceId, databaseId } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '名稱不能為空' }, { status: 400 })
    }

    if (action === 'create_workspace') {
      const newWs = await prisma.workspace.create({
        data: { name: name.trim() },
        include: { databases: true }
      })
      return NextResponse.json(newWs, { status: 201 })
    }

    if (action === 'create_database') {
      const wsId = parseInt(workspaceId)
      if (isNaN(wsId)) return NextResponse.json({ error: '缺少工作區 ID' }, { status: 400 })

      const { errorResponse } = await authorizeAction({ workspaceId: wsId, action: 'canManageStructure' })
      if (errorResponse) return errorResponse

      const newDb = await prisma.database.create({
        data: {
          name: name.trim(),
          workspaceId: wsId
        },
        include: { tables: true }
      })
      return NextResponse.json(newDb, { status: 201 })
    }

    if (action === 'create_table') {
      const dbId = parseInt(databaseId)
      if (isNaN(dbId)) return NextResponse.json({ error: '缺少資料庫 ID' }, { status: 400 })

      const { errorResponse } = await authorizeAction({ databaseId: dbId, action: 'canManageStructure' })
      if (errorResponse) return errorResponse

      const maxOrder = await prisma.databaseTable.aggregate({
        where: { databaseId: dbId },
        _max: { order: true }
      })

      const newTable = await prisma.databaseTable.create({
        data: {
          name: name.trim(),
          databaseId: dbId,
          order: (maxOrder._max.order ?? 0) + 1,
          fields: {
            create: [
              { name: '名稱', type: 'text', order: 0 }
            ]
          }
        },
        include: {
          fields: true,
          _count: { select: { rows: true } }
        }
      })
      return NextResponse.json(newTable, { status: 201 })
    }

    return NextResponse.json({ error: '無效的操作指令' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '操作失敗' }, { status: 500 })
  }
}

// PATCH: 重新命名工作區或資料庫
export async function PATCH(request: Request) {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { action, id, name } = body

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: '缺少必要參數或名稱為空' }, { status: 400 })
    }

    const targetId = parseInt(id)
    if (isNaN(targetId)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    if (action === 'rename_workspace') {
      const { errorResponse } = await authorizeAction({ workspaceId: targetId, action: 'canManageWorkspace' })
      if (errorResponse) return errorResponse

      const updated = await prisma.workspace.update({
        where: { id: targetId },
        data: { name: name.trim() }
      })
      return NextResponse.json(updated)
    }

    if (action === 'rename_database') {
      const { errorResponse } = await authorizeAction({ databaseId: targetId, action: 'canManageStructure' })
      if (errorResponse) return errorResponse

      const updated = await prisma.database.update({
        where: { id: targetId },
        data: { name: name.trim() }
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: '無效的操作指令' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新名稱失敗' }, { status: 500 })
  }
}

// DELETE: 刪除工作區或資料庫
export async function DELETE(request: Request) {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const idStr = searchParams.get('id')

    if (!action || !idStr) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 })
    }

    const targetId = parseInt(idStr)
    if (isNaN(targetId)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    if (action === 'delete_workspace') {
      const { errorResponse } = await authorizeAction({ workspaceId: targetId, action: 'canManageWorkspace' })
      if (errorResponse) return errorResponse

      const count = await prisma.workspace.count()
      if (count <= 1) {
        return NextResponse.json({ error: '必須保留至少一個工作區' }, { status: 400 })
      }

      await prisma.workspace.delete({
        where: { id: targetId }
      })
      return NextResponse.json({ message: '工作區已刪除' })
    }

    if (action === 'delete_database') {
      const { errorResponse } = await authorizeAction({ databaseId: targetId, action: 'canManageStructure' })
      if (errorResponse) return errorResponse

      await prisma.database.delete({
        where: { id: targetId }
      })
      return NextResponse.json({ message: '資料庫已刪除' })
    }

    return NextResponse.json({ error: '無效的操作指令' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除失敗' }, { status: 500 })
  }
}
