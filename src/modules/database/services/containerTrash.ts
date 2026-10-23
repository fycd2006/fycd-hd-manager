import prisma from '@/lib/prisma'

export type RestoreResult =
  | { ok: true; tableIds: number[] }
  | { ok: false; status: 400 | 404; error: string }

const NOT_FOUND: RestoreResult = { ok: false, status: 404, error: '找不到已刪除的項目' }
const TX_OPTIONS = { maxWait: 5000, timeout: 20000 }

type TargetCheckFailure = { ok: false; status: 400 | 404; error: string }

/** 目標資料庫必須存在，且它與所屬工作區都未被刪除；否則回傳失敗結果，通過回傳 null。 */
export async function checkTargetDatabaseActive(
  databaseId: number,
  client: Pick<typeof prisma, 'database'> = prisma
): Promise<TargetCheckFailure | null> {
  const target = await client.database.findUnique({
    where: { id: databaseId },
    select: { deletedAt: true, workspace: { select: { deletedAt: true } } },
  })
  if (!target) return { ok: false, status: 404, error: '找不到資料庫' }
  if (target.deletedAt || target.workspace?.deletedAt) {
    return { ok: false, status: 400, error: '請先還原資料庫' }
  }
  return null
}

export async function softDeleteWorkspace(workspaceId: number, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const databases = await tx.database.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    })
    const databaseIds = databases.map((d) => d.id)
    const tables = await tx.databaseTable.findMany({
      where: { databaseId: { in: databaseIds }, deletedAt: null },
      select: { id: true },
    })
    const tableIds = tables.map((t) => t.id)

    await tx.workspace.updateMany({ where: { id: workspaceId, deletedAt: null }, data: { deletedAt: now } })
    await tx.database.updateMany({ where: { workspaceId, deletedAt: null }, data: { deletedAt: now } })
    await tx.databaseTable.updateMany({
      where: { databaseId: { in: databaseIds }, deletedAt: null },
      data: { deletedAt: now },
    })
    await tx.tableField.updateMany({ where: { tableId: { in: tableIds }, deletedAt: null }, data: { deletedAt: now } })
    await tx.tableRow.updateMany({ where: { tableId: { in: tableIds }, deletedAt: null }, data: { deletedAt: now } })
  }, TX_OPTIONS)
}

export async function softDeleteDatabase(databaseId: number, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const tables = await tx.databaseTable.findMany({
      where: { databaseId, deletedAt: null },
      select: { id: true },
    })
    const tableIds = tables.map((t) => t.id)

    await tx.database.updateMany({ where: { id: databaseId, deletedAt: null }, data: { deletedAt: now } })
    await tx.databaseTable.updateMany({ where: { databaseId, deletedAt: null }, data: { deletedAt: now } })
    await tx.tableField.updateMany({ where: { tableId: { in: tableIds }, deletedAt: null }, data: { deletedAt: now } })
    await tx.tableRow.updateMany({ where: { tableId: { in: tableIds }, deletedAt: null }, data: { deletedAt: now } })
  }, TX_OPTIONS)
}

export async function restoreWorkspace(workspaceId: number): Promise<RestoreResult> {
  return prisma.$transaction(async (tx): Promise<RestoreResult> => {
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { deletedAt: true } })
    const T = workspace?.deletedAt
    if (!T) return NOT_FOUND

    const databases = await tx.database.findMany({
      where: { workspaceId, deletedAt: T },
      select: { id: true },
    })
    const databaseIds = databases.map((d) => d.id)
    const tables = await tx.databaseTable.findMany({
      where: { databaseId: { in: databaseIds }, deletedAt: T },
      select: { id: true },
    })
    const tableIds = tables.map((t) => t.id)

    await tx.tableRow.updateMany({ where: { tableId: { in: tableIds }, deletedAt: T }, data: { deletedAt: null } })
    await tx.tableField.updateMany({ where: { tableId: { in: tableIds }, deletedAt: T }, data: { deletedAt: null } })
    await tx.databaseTable.updateMany({
      where: { databaseId: { in: databaseIds }, deletedAt: T },
      data: { deletedAt: null },
    })
    await tx.database.updateMany({ where: { workspaceId, deletedAt: T }, data: { deletedAt: null } })
    await tx.workspace.updateMany({ where: { id: workspaceId }, data: { deletedAt: null } })
    return { ok: true, tableIds }
  }, TX_OPTIONS)
}

export async function restoreDatabase(databaseId: number): Promise<RestoreResult> {
  return prisma.$transaction(async (tx): Promise<RestoreResult> => {
    const database = await tx.database.findUnique({
      where: { id: databaseId },
      select: { deletedAt: true, workspace: { select: { deletedAt: true } } },
    })
    const T = database?.deletedAt
    if (!T) return NOT_FOUND
    if (database?.workspace?.deletedAt) return { ok: false, status: 400, error: '請先還原工作區' }

    const tables = await tx.databaseTable.findMany({
      where: { databaseId, deletedAt: T },
      select: { id: true },
    })
    const tableIds = tables.map((t) => t.id)

    await tx.tableRow.updateMany({ where: { tableId: { in: tableIds }, deletedAt: T }, data: { deletedAt: null } })
    await tx.tableField.updateMany({ where: { tableId: { in: tableIds }, deletedAt: T }, data: { deletedAt: null } })
    await tx.databaseTable.updateMany({ where: { databaseId, deletedAt: T }, data: { deletedAt: null } })
    await tx.database.updateMany({ where: { id: databaseId }, data: { deletedAt: null } })
    return { ok: true, tableIds }
  }, TX_OPTIONS)
}

export async function restoreTable(
  tableId: number,
  extra?: { name?: string; order?: number; databaseId?: number }
): Promise<RestoreResult> {
  return prisma.$transaction(async (tx): Promise<RestoreResult> => {
    const table = await tx.databaseTable.findUnique({
      where: { id: tableId },
      select: { deletedAt: true, database: { select: { deletedAt: true } } },
    })
    const T = table?.deletedAt
    if (!T) return NOT_FOUND
    if (table?.database?.deletedAt) return { ok: false, status: 400, error: '請先還原資料庫' }

    if (extra?.databaseId !== undefined) {
      const failure = await checkTargetDatabaseActive(extra.databaseId, tx)
      if (failure) return failure
    }

    await tx.databaseTable.update({
      where: { id: tableId },
      data: {
        deletedAt: null,
        ...(extra?.name && { name: extra.name }),
        ...(extra?.order !== undefined && { order: extra.order }),
        ...(extra?.databaseId !== undefined && { databaseId: extra.databaseId }),
      },
    })
    await tx.tableRow.updateMany({ where: { tableId, deletedAt: T }, data: { deletedAt: null } })
    await tx.tableField.updateMany({ where: { tableId, deletedAt: T }, data: { deletedAt: null } })
    return { ok: true, tableIds: [tableId] }
  }, TX_OPTIONS)
}
