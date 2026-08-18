import { SingleSelectFieldType } from '../SingleSelectFieldType'
import { MultipleSelectFieldType } from '../MultipleSelectFieldType'

describe('SingleSelectFieldType', () => {
  const type = new SingleSelectFieldType()

  const options = {
    choices: [
      { id: 'opt_1', name: 'Option A', color: 'red' },
      { id: 'opt_2', name: 'Option B', color: 'blue' }
    ]
  }

  const legacyOptions = {
    choices: ['Option A', 'Option B']
  }

  it('validates and maps old string name to ID', () => {
    const res = type.validateValue('Option A', options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe('opt_1')
  })

  it('validates and accepts ID directly', () => {
    const res = type.validateValue('opt_2', options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe('opt_2')
  })

  it('gracefully accepts new option string without rejecting', () => {
    const res = type.validateValue('Ghost', options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe('Ghost')
  })

  it('supports legacy options array', () => {
    const res = type.validateValue('Option B', legacyOptions)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe('Option B')
  })
})

describe('MultipleSelectFieldType', () => {
  const type = new MultipleSelectFieldType()

  const options = {
    choices: [
      { id: 'opt_1', name: 'Option A', color: 'red' },
      { id: 'opt_2', name: 'Option B', color: 'blue' },
      { id: 'opt_3', name: 'Option C', color: 'green' }
    ]
  }

  it('validates and maps legacy comma-separated string to ID array', () => {
    const res = type.validateValue('Option A, Option C', options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe(JSON.stringify(['opt_1', 'opt_3']))
  })

  it('validates and maps legacy JSON array of names to ID array', () => {
    const res = type.validateValue(JSON.stringify(['Option B', 'Option C']), options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe(JSON.stringify(['opt_2', 'opt_3']))
  })

  it('validates and accepts array of IDs', () => {
    const res = type.validateValue(['opt_1', 'opt_2'], options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe(JSON.stringify(['opt_1', 'opt_2']))
  })

  it('gracefully accepts new option items without rejecting', () => {
    const res = type.validateValue(['opt_1', 'Ghost'], options)
    expect(res.valid).toBe(true)
    expect(res.parsedValue).toBe(JSON.stringify(['opt_1', 'Ghost']))
  })
})
