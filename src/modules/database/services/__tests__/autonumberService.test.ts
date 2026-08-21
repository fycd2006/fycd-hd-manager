import { allocateAutonumbers } from '../autonumberService'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}))

describe('allocateAutonumbers (Problem #8 Atomic Autonumber Allocation)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allocates a sequential block of numbers atomically when counter is already initialized', async () => {
    ;(prisma.databaseTable.findUnique as jest.Mock).mockResolvedValueOnce({
      autonumberCounter: 10,
    })
    ;(prisma.databaseTable.update as jest.Mock).mockResolvedValueOnce({
      autonumberCounter: 13,
    })

    const allocated = await allocateAutonumbers(1, 3, [100])

    expect(allocated).toEqual([11, 12, 13])
    expect(prisma.databaseTable.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { autonumberCounter: { increment: 3 } },
      select: { autonumberCounter: true },
    })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('performs cold-start SQL aggregation when counter is 0 and initializes counter to max existing value', async () => {
    ;(prisma.databaseTable.findUnique as jest.Mock).mockResolvedValueOnce({
      autonumberCounter: 0,
    })
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ maxVal: 42 }])
    ;(prisma.databaseTable.update as jest.Mock)
      .mockResolvedValueOnce({ id: 1, autonumberCounter: 42 }) // initialization update
      .mockResolvedValueOnce({ id: 1, autonumberCounter: 43 }) // allocation increment

    const allocated = await allocateAutonumbers(1, 1, [101])

    expect(allocated).toEqual([43])
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prisma.databaseTable.update).toHaveBeenCalledTimes(2)
  })

  it('returns empty array when count is 0 or negative', async () => {
    const allocated = await allocateAutonumbers(1, 0, [100])
    expect(allocated).toEqual([])
    expect(prisma.databaseTable.findUnique).not.toHaveBeenCalled()
  })
})
