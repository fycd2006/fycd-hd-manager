const { PrismaClient } = require('@prisma/client')

const prodUrl = "mysql://GzzJk9ZLH4uxhHX.root:XX7Mm6h0jYWz3AsL@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/FYCDHDMANAGER?sslaccept=strict"
const devUrl = "mysql://GzzJk9ZLH4uxhHX.root:XX7Mm6h0jYWz3AsL@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/FYCDHDMANAGER_DEV?sslaccept=strict"

const prodPrisma = new PrismaClient({ datasources: { db: { url: prodUrl } } })
const devPrisma = new PrismaClient({ datasources: { db: { url: devUrl } } })

async function main() {
  console.log('Cloning data from FYCDHDMANAGER -> FYCDHDMANAGER_DEV...')

  // 1. Users
  const users = await prodPrisma.user.findMany()
  console.log(`Found ${users.length} users`)
  for (const u of users) {
    await devPrisma.user.upsert({
      where: { id: u.id },
      update: u,
      create: u
    })
  }

  // 2. Workspaces
  const workspaces = await prodPrisma.workspace.findMany({
    include: {
      databases: {
        include: {
          tables: {
            include: {
              fields: true,
              rows: true,
              views: true
            }
          }
        }
      }
    }
  })
  console.log(`Found ${workspaces.length} workspaces`)

  for (const ws of workspaces) {
    await devPrisma.workspace.upsert({
      where: { id: ws.id },
      update: { name: ws.name, createdAt: ws.createdAt, updatedAt: ws.updatedAt },
      create: { id: ws.id, name: ws.name, createdAt: ws.createdAt, updatedAt: ws.updatedAt }
    })

    for (const db of ws.databases) {
      await devPrisma.database.upsert({
        where: { id: db.id },
        update: { name: db.name, workspaceId: db.workspaceId, createdAt: db.createdAt, updatedAt: db.updatedAt },
        create: { id: db.id, name: db.name, workspaceId: db.workspaceId, createdAt: db.createdAt, updatedAt: db.updatedAt }
      })

      for (const tbl of db.tables) {
        await devPrisma.databaseTable.upsert({
          where: { id: tbl.id },
          update: { name: tbl.name, order: tbl.order, databaseId: tbl.databaseId, createdAt: tbl.createdAt, updatedAt: tbl.updatedAt, deletedAt: tbl.deletedAt },
          create: { id: tbl.id, name: tbl.name, order: tbl.order, databaseId: tbl.databaseId, createdAt: tbl.createdAt, updatedAt: tbl.updatedAt, deletedAt: tbl.deletedAt }
        })

        for (const f of tbl.fields) {
          await devPrisma.tableField.upsert({
            where: { id: f.id },
            update: { tableId: f.tableId, name: f.name, type: f.type, order: f.order, options: f.options, createdAt: f.createdAt, deletedAt: f.deletedAt },
            create: { id: f.id, tableId: f.tableId, name: f.name, type: f.type, order: f.order, options: f.options, createdAt: f.createdAt, deletedAt: f.deletedAt }
          })
        }

        for (const r of tbl.rows) {
          await devPrisma.tableRow.upsert({
            where: { id: r.id },
            update: { tableId: r.tableId, data: r.data, order: r.order, createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt },
            create: { id: r.id, tableId: r.tableId, data: r.data, order: r.order, createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt }
          })
        }

        for (const v of tbl.views) {
          await devPrisma.tableView.upsert({
            where: { id: v.id },
            update: { tableId: v.tableId, name: v.name, type: v.type, filters: v.filters, sortField: v.sortField, sortOrder: v.sortOrder, hiddenFields: v.hiddenFields, columnWidths: v.columnWidths, rowColors: v.rowColors, groupByField: v.groupByField, createdAt: v.createdAt, updatedAt: v.updatedAt },
            create: { id: v.id, tableId: v.tableId, name: v.name, type: v.type, filters: v.filters, sortField: v.sortField, sortOrder: v.sortOrder, hiddenFields: v.hiddenFields, columnWidths: v.columnWidths, rowColors: v.rowColors, groupByField: v.groupByField, createdAt: v.createdAt, updatedAt: v.updatedAt }
          })
        }
      }
    }
  }

  console.log('✅ Successfully cloned production database to FYCDHDMANAGER_DEV!')
}

main().catch(err => {
  console.error('Clone failed:', err)
  process.exit(1)
}).finally(async () => {
  await prodPrisma.$disconnect()
  await devPrisma.$disconnect()
})
