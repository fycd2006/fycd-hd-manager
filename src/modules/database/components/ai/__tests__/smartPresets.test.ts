import { generateSmartPresets } from '../smartPresets'
import type { TableField } from '@/modules/database/types'

describe('generateSmartPresets', () => {
  it('generates fallback presets when fields array is empty', () => {
    const presets = generateSmartPresets({ fields: [] })
    expect(presets.length).toBeGreaterThan(0)
    expect(presets[0].prompt).toContain('統計這張表格目前的總人數')
  })

  it('generates dynamic presets based on actual table fields and choices', () => {
    const mockFields: TableField[] = [
      { id: 1, tableId: 10, name: '產品名稱', type: 'text', order: 1, options: null },
      {
        id: 2,
        tableId: 10,
        name: '庫存狀態',
        type: 'single_select',
        order: 2,
        options: JSON.stringify({ choices: [{ id: 'opt-1', name: '缺貨中' }, { id: 'opt-2', name: '現貨' }] }),
      },
      { id: 3, tableId: 10, name: '單價', type: 'number', order: 3, options: null },
    ]

    const presets = generateSmartPresets({ fields: mockFields })
    expect(presets.length).toBeGreaterThanOrEqual(3)

    // Check select field suggestions
    const fillPrompt = presets.find(p => p.prompt.includes('庫存狀態'))
    expect(fillPrompt).toBeDefined()
    expect(fillPrompt?.prompt).toContain('庫存狀態')

    // Check number field aggregate suggestion
    const numPrompt = presets.find(p => p.prompt.includes('單價'))
    expect(numPrompt).toBeDefined()
    expect(numPrompt?.prompt).toContain('單價')
  })

  it('prioritizes selection presets when selectedRowIds are provided', () => {
    const mockFields: TableField[] = [
      { id: 1, tableId: 10, name: '姓名', type: 'text', order: 1, options: null },
      {
        id: 2,
        tableId: 10,
        name: '組別',
        type: 'single_select',
        order: 2,
        options: JSON.stringify({ choices: [{ id: 'opt-1', name: '建興組' }] }),
      },
    ]

    const presets = generateSmartPresets({
      fields: mockFields,
      selectedRowIds: [101, 102, 103],
    })

    expect(presets[0].category).toBe('selection')
    expect(presets[0].prompt).toContain('選取的 3 筆資料')
  })
})
