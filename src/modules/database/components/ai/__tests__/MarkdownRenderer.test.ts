import { normalizeMarkdownAndLatex } from '../markdownUtils'

describe('normalizeMarkdownAndLatex', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeMarkdownAndLatex('')).toBe('')
  })

  it('converts LaTeX display math \\[ ... \\] to $$ ... $$', () => {
    const raw = '公式如下：\n\\[ \\sum_{i=1}^n x_i = 100 \\]'
    const result = normalizeMarkdownAndLatex(raw)
    expect(result).toContain('$$\n\\sum_{i=1}^n x_i = 100\n$$')
  })

  it('converts LaTeX inline math \\( ... \\) to $ ... $', () => {
    const raw = '其中變數 \\( x = 42 \\) 代表總筆數'
    const result = normalizeMarkdownAndLatex(raw)
    expect(result).toBe('其中變數 $x = 42$ 代表總筆數')
  })

  it('fixes broken bold wraps with newline before closing asterisks', () => {
    const raw = '這張表格目前的**總人數為 62 筆資料列\n** 。'
    const result = normalizeMarkdownAndLatex(raw)
    expect(result).toBe('這張表格目前的**總人數為 62 筆資料列**\n 。')
  })

  it('preserves standard markdown headers, lists and tables', () => {
    const raw = '### 1. 負責人分佈\n* **陳迺軒** : 27 筆\n* **李庭逸** : 21 筆'
    const result = normalizeMarkdownAndLatex(raw)
    expect(result).toBe(raw)
  })
})
