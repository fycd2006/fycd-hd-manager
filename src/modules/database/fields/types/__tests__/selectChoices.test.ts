import { resolveChoices } from '../selectChoices'
import { FieldRegistry } from '..'

const opts = { choices: [{ id: 'a', name: '蔬菜' }, { id: 'b', name: '肉類' }, { id: '蔬菜', name: '其他' }] }

describe('resolveChoices', () => {
  it('matches id before name, names case-insensitively', () => {
    expect(resolveChoices('蔬菜', opts, 'single')).toEqual({ ids: ['蔬菜'], unknown: [] })
    expect(resolveChoices(' 肉類 ', opts, 'single')).toEqual({ ids: ['b'], unknown: [] })
    expect(resolveChoices('X', { choices: [{ id: 'x1', name: 'Xy' }] }, 'single').unknown).toEqual(['X'])
    expect(resolveChoices('xY', { choices: [{ id: 'x1', name: 'Xy' }] }, 'single').ids).toEqual(['x1'])
  })
  it('dedupes ids and reports unknown names once', () => {
    expect(resolveChoices('a, 甜點,a,甜點', opts, 'multi')).toEqual({ ids: ['a'], unknown: ['甜點'] })
    expect(resolveChoices(['b', 'b'], opts, 'multi')).toEqual({ ids: ['b'], unknown: [] })
    expect(resolveChoices(['Ghost', 'ghost'], opts, 'multi').unknown).toEqual(['Ghost'])
  })
  it('treats a comma inside a single-select value as part of the name', () => {
    expect(resolveChoices('a,b', opts, 'single')).toEqual({ ids: [], unknown: ['a,b'] })
  })
  it('parses JSON array strings in multi mode', () => {
    expect(resolveChoices('["a","b"]', opts, 'multi')).toEqual({ ids: ['a', 'b'], unknown: [] })
  })
})

describe('select field types reject unknown options', () => {
  it('single_select', () => {
    const r = FieldRegistry.get('single_select')!.validateValue('ghost', opts)
    expect(r).toMatchObject({ valid: false, code: 'unknown_option' })
    expect((r as { error: string }).error).toBe('選項「ghost」不存在')
  })
  it('multiple_select dedupes and rejects', () => {
    expect(FieldRegistry.get('multiple_select')!.validateValue(['a', 'a'], opts)).toEqual({ valid: true, parsedValue: '["a"]' })
    expect(FieldRegistry.get('multiple_select')!.validateValue(['a', 'ghost'], opts)).toMatchObject({ valid: false, code: 'unknown_option' })
  })
})
