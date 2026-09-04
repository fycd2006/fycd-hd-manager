/**
 * @jest-environment jsdom
 */

import { resolveChoiceString, parseSelectItems } from '../cells/utils'
import { formatCellForClipboard } from '../GridView'

describe('Choice Resolution & Raw ID Leak Prevention', () => {
  beforeEach(() => {
    delete (window as any).fields
    delete (window as any).fetchTableData
    delete (window as any).__activeTableId
    jest.clearAllMocks()
  })

  it('resolves option ID to human-readable name when choices are provided in fieldOptions', () => {
    const options = {
      choices: [
        { id: 'opt_tzs0c4m0w', name: '建興組', color: 'blue' },
        { id: 'opt_abc123456', name: '大安組', color: 'green' },
      ],
    }

    expect(resolveChoiceString('opt_tzs0c4m0w', options)).toBe('建興組')
    expect(resolveChoiceString('opt_abc123456', options)).toBe('大安組')
    expect(resolveChoiceString('建興組', options)).toBe('建興組')
  })

  it('resolves option ID via window.fields fallback when local fieldOptions is temporarily outdated', () => {
    ;(window as any).fields = [
      {
        id: 1,
        name: '組別',
        type: 'single_select',
        options: {
          choices: [{ id: 'opt_tzs0c4m0w', name: '建興組' }],
        },
      },
    ]

    // Empty local options (simulating race condition before field state update)
    const result = resolveChoiceString('opt_tzs0c4m0w', {})
    expect(result).toBe('建興組')
  })

  it('suppresses raw opt_* IDs and triggers background self-healing fetch when option is unknown', () => {
    const mockFetch = jest.fn().mockResolvedValue(undefined)
    ;(window as any).fetchTableData = mockFetch
    ;(window as any).__activeTableId = 42

    const result = resolveChoiceString('opt_tzs0c4m0w', { choices: [] })

    // Must return empty string so it is NEVER rendered as raw opt_xxxx chip
    expect(result).toBe('')

    // Should trigger fetchTableData for the active table
    expect(mockFetch).toHaveBeenCalledWith(42)
  })

  it('preserves standard user text and suppresses raw UUID patterns', () => {
    expect(resolveChoiceString('一般文字內容')).toBe('一般文字內容')
    expect(resolveChoiceString('12345678-1234-1234-1234-123456789abc')).toBe('')
  })

  it('correctly parses select items without raw ID leak', () => {
    const options = {
      choices: [
        { id: 'opt_1', name: 'Alpha' },
      ],
    }

    const items = parseSelectItems(['opt_1', 'opt_unknown99'], options)
    expect(items).toEqual(['Alpha'])
  })

  it('formats select cells for clipboard into readable text instead of raw UUID JSON', () => {
    const selectField = {
      id: 10,
      name: '邀約狀態',
      type: 'single_select',
      options: {
        choices: [
          { id: '2c268bb4-ad70-4e2a-ac2e-9e8bde1d2496', name: '初一十五' },
          { id: 'opt_regular', name: '常態出席' }
        ]
      }
    } as any

    // Copying raw UUID string
    expect(formatCellForClipboard('2c268bb4-ad70-4e2a-ac2e-9e8bde1d2496', selectField)).toBe('初一十五')
    
    // Copying raw JSON array of UUIDs (as stored in TiDB database row data)
    expect(formatCellForClipboard('["2c268bb4-ad70-4e2a-ac2e-9e8bde1d2496"]', selectField)).toBe('初一十五')
    expect(formatCellForClipboard(['2c268bb4-ad70-4e2a-ac2e-9e8bde1d2496'], selectField)).toBe('初一十五')

    // Boolean field
    const boolField = { id: 11, name: '已完成', type: 'boolean' } as any
    expect(formatCellForClipboard(true, boolField)).toBe('是')
    expect(formatCellForClipboard(false, boolField)).toBe('否')

    // Standard text
    const textField = { id: 12, name: '姓名', type: 'text' } as any
    expect(formatCellForClipboard('王大明', textField)).toBe('王大明')
  })
})

