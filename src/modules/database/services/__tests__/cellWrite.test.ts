import { prepareCellWrites, prepareBatchCellWrites, mergeChoicesIntoOptions, applyChoiceRemap, formatRejection, type FieldMeta } from '../cellWrite'

const fields: FieldMeta[] = [
  { id: 1, name: '名稱', type: 'text', options: null },
  { id: 2, name: '數量', type: 'number', options: { defaultValue: 0 } },
  { id: 3, name: '編號', type: 'autonumber', options: null },
  { id: 4, name: '類別', type: 'single_select', options: { choices: [{ id: 'a', name: '蔬菜' }] } },
  { id: 5, name: '留言', type: 'latest_comment', options: null },
  { id: 6, name: '怪', type: 'no_such_type', options: null },
  { id: 7, name: '標籤', type: 'multiple_select', options: { choices: [] } },
]

describe('prepareCellWrites', () => {
  it('splits valid values from rejected ones', () => {
    const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false,
      input: { field_1: ' 米 ', field_2: 'abc', field_3: 9, field_4: '甜點', field_99: 'x', title: 'y' } })
    expect(r.data).toEqual({ field_1: '米' })
    expect(r.rejected.map((x) => [x.fieldId, x.code])).toEqual([[2, 'invalid_number'], [3, 'read_only'], [4, 'unknown_option']])
    expect(r.rejected[1].reason).toBe('此欄位為唯讀，無法寫入')
    expect(r.optionAdditions).toEqual({})
  })
  it('treats blank values for read-only fields as not provided', () => {
    for (const blank of ['', '  ', null, undefined, []]) {
      const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false, input: { field_3: blank } })
      expect(r.rejected).toEqual([])
      expect(r.data).toEqual({})
    }
    const batch = prepareBatchCellWrites({ fields, mode: 'create', canAddOptions: false, rows: [{ key: 'a', input: { field_3: '' } }] })
    expect(batch.rows[0].rejected).toEqual([])
    expect(batch.rows[0].data).not.toHaveProperty('field_3')
  })
  it('still rejects non-empty values for read-only fields', () => {
    const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false, input: { field_3: 9 } })
    expect(r.rejected.map((x) => x.code)).toEqual(['read_only'])
  })
  it('adds unknown options when allowed and stores the new id', () => {
    const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: true, input: { field_4: '甜點' } })
    const [added] = r.optionAdditions[4]
    expect(added).toMatchObject({ name: '甜點' })
    expect(added.color).toBeDefined()
    expect(r.data.field_4).toBe(added.id)
  })
  it('fills defaults on create, including 0', () => {
    expect(prepareCellWrites({ fields, mode: 'create', canAddOptions: false, input: {} }).data).toEqual({ field_2: 0, field_5: [] })
  })
  it('rejects unregistered types as unknown_type (fail closed)', () => {
    const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false, input: { field_6: 'x' } })
    expect(r.rejected.map((x) => x.code)).toEqual(['unknown_type'])
    expect(r.data).toEqual({})
  })
  it('formats a rejection', () => {
    expect(formatRejection('數量', { fieldId: 2, code: 'invalid_number', reason: '不是數字' })).toBe('欄位 [數量] 驗證失敗：不是數字')
  })

  describe('latest_comment anti-forgery', () => {
    const existing = { field_5: [{ id: 'c1', user: 'alice', time: 'T0', content: 'old' }] }
    const input = {
      field_5: [
        { id: 'c1', user: 'mallory', time: 'forged', content: 'old' },
        { id: 'c2', user: 'mallory', time: 'forged', content: 'new' },
      ],
    }
    it('stamps new entries with actor and keeps stored ones', () => {
      const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false, input, existing, actor: { username: 'bob' } })
      const list = r.data.field_5 as Array<Record<string, string>>
      expect(list[0]).toMatchObject({ id: 'c1', user: 'alice', time: 'T0' })
      expect(list[1]).toMatchObject({ id: 'c2', user: 'bob' })
      expect(list[1].time).not.toBe('forged')
    })
    it('leaves entries as validated without actor', () => {
      const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false, input, existing })
      expect((r.data.field_5 as Array<Record<string, string>>)[1].user).toBe('mallory')
    })
    it('works per row in batch', () => {
      const r = prepareBatchCellWrites({ fields, mode: 'update', canAddOptions: false, actor: { username: 'bob' },
        rows: [{ key: 1, input, existing }, { key: 2, input }] })
      const a = r.rows[0].data.field_5 as Array<Record<string, string>>
      const b = r.rows[1].data.field_5 as Array<Record<string, string>>
      expect(a[0].user).toBe('alice')
      expect(b[0].user).toBe('bob')
    })
  })
})

describe('prepareBatchCellWrites', () => {
  it('creates one option for the same new name across a batch', () => {
    const r = prepareBatchCellWrites({ fields, mode: 'update', canAddOptions: true,
      rows: [{ key: 1, input: { field_4: '甜點' } }, { key: 2, input: { field_4: '甜點 ' } }] })
    expect(r.optionAdditions[4]).toHaveLength(1)
    expect(r.rows[0].data.field_4).toBe(r.rows[1].data.field_4)
  })
})

describe('mergeChoicesIntoOptions', () => {
  const add = [{ id: 'n', name: 'Sweet' }, { id: 'm', name: '新' }]
  it('keeps each container shape', () => {
    expect(mergeChoicesIntoOptions([{ id: 'a', name: 'A' }], add)).toEqual([{ id: 'a', name: 'A' }, ...add])
    expect(mergeChoicesIntoOptions({ x: 1, select_options: [] }, add)).toEqual({ x: 1, select_options: add })
    expect(mergeChoicesIntoOptions({ options: [] }, add)).toEqual({ options: add })
    expect(mergeChoicesIntoOptions({ choices: [] }, add)).toEqual({ choices: add })
    expect(mergeChoicesIntoOptions(null, add)).toEqual({ choices: add })
  })
  it('skips names that already exist, case-insensitively', () => {
    expect(mergeChoicesIntoOptions({ choices: [{ id: 'a', name: 'sweet' }] }, add)).toEqual({ choices: [{ id: 'a', name: 'sweet' }, add[1]] })
  })
})

describe('applyChoiceRemap', () => {
  const remap = { 4: { new: 'old' }, 7: { new: 'old' } }
  it('remaps single and multi select values and leaves others alone', () => {
    const data = { field_1: 'new', field_4: 'new', field_7: JSON.stringify(['new', 'x']) }
    const out = applyChoiceRemap(data, fields, remap)
    expect(out).toEqual({ field_1: 'new', field_4: 'old', field_7: JSON.stringify(['old', 'x']) })
    expect(data.field_4).toBe('new')
  })
  it('dedupes multi values that already contain the existing id', () => {
    const out = applyChoiceRemap({ field_7: JSON.stringify(['old', 'new', 'x']) }, fields, remap)
    expect(out.field_7).toBe(JSON.stringify(['old', 'x']))
  })
  it('leaves non-remapped ids untouched', () => {
    expect(applyChoiceRemap({ field_4: 'a' }, fields, remap)).toEqual({ field_4: 'a' })
  })
})
