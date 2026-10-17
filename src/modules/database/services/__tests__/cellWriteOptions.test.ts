import { applyOptionAdditions } from '../cellWriteOptions'
import type { Prisma } from '@prisma/client'

function makeTx(found: unknown) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    tableField: {
      findFirst: jest.fn().mockResolvedValue(found),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: number }; data: { options: unknown } }) => ({ id: where.id, options: data.options })),
    },
  }
}

describe('applyOptionAdditions', () => {
  it('merges into freshly re-read options, preserving concurrent additions', async () => {
    const tx = makeTx({ options: { choices: [{ id: 'a', name: '蔬菜' }, { id: 'z', name: '別人剛加的' }] } })
    const { updated, remap } = await applyOptionAdditions(tx as unknown as Prisma.TransactionClient, 10, { 4: [{ id: 'n', name: '甜點' }] })
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.tableField.findFirst.mock.invocationCallOrder[0])
    expect(remap).toEqual({})
    expect(tx.tableField.findFirst).toHaveBeenCalledWith({ where: { id: 4, tableId: 10, deletedAt: null } })
    const opts = tx.tableField.update.mock.calls[0][0].data.options as { choices: Array<{ id: string }> }
    expect(opts.choices.map((c) => c.id)).toEqual(['a', 'z', 'n'])
    expect(updated[0].id).toBe(4)
  })
  it('skips fields that no longer exist', async () => {
    const tx = makeTx(null)
    const r = await applyOptionAdditions(tx as unknown as Prisma.TransactionClient, 10, { 4: [{ id: 'n', name: '甜點' }] })
    expect(tx.tableField.update).not.toHaveBeenCalled()
    expect(r).toEqual({ updated: [], remap: {} })
  })
  it('drops a duplicate-name addition and reports the remap', async () => {
    const tx = makeTx({ options: { choices: [{ id: 'old', name: '甜點' }] } })
    const { remap } = await applyOptionAdditions(tx as unknown as Prisma.TransactionClient, 10, { 4: [{ id: 'new', name: '甜點' }] })
    const opts = tx.tableField.update.mock.calls[0][0].data.options as { choices: Array<{ id: string }> }
    expect(opts.choices.map((c) => c.id)).toEqual(['old'])
    expect(remap).toEqual({ 4: { new: 'old' } })
  })
})
