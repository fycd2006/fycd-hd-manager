import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { parseAirtableBasePayload } from '@/lib/airtable/airtableImporter'
import { fetchAirtableSchemaWithToken, extractAirtableId } from '@/lib/airtable/auth'
import { fetchAllTablesFromSharedLink } from '@/lib/airtable/airtableScraper'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/airtable/airtableImporter', () => ({
  parseAirtableBasePayload: jest.fn(),
}))

jest.mock('@/lib/airtable/auth', () => ({
  fetchAirtableSchemaWithToken: jest.fn(),
  extractAirtableId: jest.fn(),
}))

jest.mock('@/lib/airtable/airtableScraper', () => ({
  fetchAllTablesFromSharedLink: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    database: { create: jest.fn() },
    databaseTable: { create: jest.fn() },
    tableField: { create: jest.fn() },
    tableRow: { create: jest.fn() },
    tableView: { create: jest.fn() },
  },
}))

const importBase = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/database/import/airtable', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

const converted = [{
  name: '食材',
  fields: [{ name: '品名', type: 'text' }, { name: '價格', type: 'number', options: { precision: 0 } }],
  rows: [{ data: { 品名: '米', 價格: 30, 不存在: 'x' } }],
}]

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1 })
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'builder' } })
  ;(parseAirtableBasePayload as jest.Mock).mockReturnValue(converted)
  ;(prisma.database.create as jest.Mock).mockResolvedValue({ id: 50 })
  ;(prisma.databaseTable.create as jest.Mock).mockResolvedValue({ id: 60 })
  let fieldId = 70
  ;(prisma.tableField.create as jest.Mock).mockImplementation(async () => ({ id: fieldId++ }))
})

describe('POST /api/database/import/airtable', () => {
  it('requires login', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await importBase({ workspaceId: 5, rawPayload: {} })

    expect(res.status).toBe(401)
    expect(prisma.database.create).not.toHaveBeenCalled()
  })

  it('requires canManageStructure on the target workspace', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ errorResponse: NextResponse.json({}, { status: 403 }) })

    const res = await importBase({ workspaceId: '5', rawPayload: {} })

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 5, action: 'canManageStructure' })
    expect(parseAirtableBasePayload).not.toHaveBeenCalled()
  })

  it('returns 400 without a workspace or any import source', async () => {
    expect((await importBase({ rawPayload: {} })).status).toBe(400)
    expect((await importBase({ workspaceId: 5 })).status).toBe(400)
    expect(prisma.database.create).not.toHaveBeenCalled()
  })

  it('imports a raw payload into a new database in the workspace, mapping cells by field name', async () => {
    const res = await importBase({ workspaceId: 5, rawPayload: { name: '伙食團 Base' } })

    expect(res.status).toBe(200)
    expect(prisma.database.create).toHaveBeenCalledWith({ data: { name: '伙食團 Base', workspaceId: 5 } })
    expect(prisma.databaseTable.create).toHaveBeenCalledWith({ data: { name: '食材', databaseId: 50, order: 0 } })
    expect(prisma.tableField.create).toHaveBeenNthCalledWith(2, {
      data: { tableId: 60, name: '價格', type: 'number', order: 1, options: { precision: 0 } },
    })
    expect(prisma.tableRow.create).toHaveBeenCalledWith({
      data: { tableId: 60, data: { field_70: '米', field_71: 30 }, order: 0 },
    })
    expect(prisma.tableView.create).toHaveBeenCalledWith({ data: { tableId: 60, name: '全部資料', type: 'grid' } })
    expect((await res.json()).stats).toEqual({ tableCount: 1, rowCount: 1 })
  })

  it('uses the personal access token API for a base URL with a token', async () => {
    ;(extractAirtableId as jest.Mock).mockReturnValue({ type: 'base', id: 'appABC' })
    ;(fetchAirtableSchemaWithToken as jest.Mock).mockResolvedValue({ tables: [] })

    await importBase({ workspaceId: 5, shareUrl: 'https://airtable.com/appABC', token: 'pat' })

    expect(fetchAirtableSchemaWithToken).toHaveBeenCalledWith('appABC', 'pat')
    expect(prisma.database.create).toHaveBeenCalledWith({ data: { name: 'Airtable 匯入 (appABC)', workspaceId: 5 } })
  })

  it('rejects a token import whose URL is not a base', async () => {
    ;(extractAirtableId as jest.Mock).mockReturnValue({ type: 'share', id: 'shrX' })

    const res = await importBase({ workspaceId: 5, shareUrl: 'https://airtable.com/shrX', token: 'pat' })

    expect(res.status).toBe(400)
    expect(fetchAirtableSchemaWithToken).not.toHaveBeenCalled()
  })

  it('scrapes a public share link when no token is given', async () => {
    ;(fetchAllTablesFromSharedLink as jest.Mock).mockResolvedValue({ name: '公開 Base' })

    await importBase({ workspaceId: 5, shareUrl: 'https://airtable.com/shrX' })

    expect(fetchAllTablesFromSharedLink).toHaveBeenCalledWith('https://airtable.com/shrX')
    expect(prisma.database.create).toHaveBeenCalledWith({ data: { name: '公開 Base', workspaceId: 5 } })
  })
})
