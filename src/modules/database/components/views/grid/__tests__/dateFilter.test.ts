import { evaluateCellCondition } from '../cells/utils'

const field = { type: 'date', options: { date_include_time: true, date_time_zone: 'Asia/Taipei' } }

describe('evaluateCellCondition date operators', () => {
  it.each([
    ['2026-10-17T23:59:00.000Z', 'date_equal', '2026-10-18', true],
    ['2026-10-17T15:59:00.000Z', 'date_equal', '2026-10-18', false],
    ['2026-10-17T23:59:00.000Z', 'date_before', '2026-10-19', true],
    ['2026-10-17T23:59:00.000Z', 'date_after', '2026-10-18', false],
    ['2026-10-18', 'date_equal', '2026-10-18', true],
    ['', 'date_equal', '2026-10-18', false],
  ])('%s %s %s -> %s', (val, op, target, expected) => {
    expect(evaluateCellCondition(val, field, op, target)).toBe(expected)
  })
})
