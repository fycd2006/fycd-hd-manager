import { DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/linkRowSync', () => ({
  cleanupRowLinkRowRelations: jest.fn().mockResolvedValue(undefined),
  cleanupInboundLinkRowReferences: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/masterViewOverride', () => ({
  softDeleteMasterViewOverrides: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback({
          $executeRaw: jest.fn(),
          tableField: { delete: jest.fn() },
          tableRow: { delete: jest.fn() },
        })
      }
      return Promise.resolve([])
    }),
  },
}))

describe('Trash Route Handler: /api/tables/[tableId]/trash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('DELETE with type=field: should execute JSON_REMOVE on TableRow and delete TableField inside transaction', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })

    const mockExecuteRaw = jest.fn().mockResolvedValue(1)
    const mockFieldDelete = jest.fn().mockResolvedValue({ id: 50 })

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        $executeRaw: mockExecuteRaw,
        tableField: { delete: mockFieldDelete },
      })
    })

    const request = new Request('http://localhost:3000/api/tables/10/trash?type=field&id=50', {
      method: 'DELETE',
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await DELETE(request, { params })
    expect(response.status).toBe(200)

    // Assert transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()
    // Assert JSON_REMOVE SQL was executed
    expect(mockExecuteRaw).toHaveBeenCalled()
    // Assert tableField.delete was executed
    expect(mockFieldDelete).toHaveBeenCalledWith({
      where: { id: 50, tableId: 10 },
    })
  })
})
