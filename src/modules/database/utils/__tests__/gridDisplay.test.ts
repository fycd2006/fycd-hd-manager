import {
  computeGridDisplay,
  normalizeFontScale,
  normalizeRowHeight,
  FONT_SCALES,
  FONT_SCALE_LABELS,
  ROW_HEIGHTS,
  ROW_HEIGHT_LABELS,
  FontScale,
  RowHeight,
} from '../gridDisplay'

describe('gridDisplay', () => {
  describe('constants', () => {
    it('defines expected row heights and labels', () => {
      expect(ROW_HEIGHTS).toEqual(['small', 'medium', 'large', 'extra'])
      expect(ROW_HEIGHT_LABELS).toEqual({
        small: '小',
        medium: '中',
        large: '大',
        extra: '特大',
      })
    })

    it('defines expected font scales and labels', () => {
      expect(FONT_SCALES).toEqual(['standard', 'large', 'xlarge'])
      expect(FONT_SCALE_LABELS).toEqual({
        standard: '標準',
        large: '大',
        xlarge: '特大',
      })
    })
  })

  describe('normalizeRowHeight', () => {
    it('falls back to small for invalid or missing values', () => {
      expect(normalizeRowHeight(null)).toBe('small')
      expect(normalizeRowHeight(undefined)).toBe('small')
      expect(normalizeRowHeight('huge')).toBe('small')
      expect(normalizeRowHeight(3)).toBe('small')
      expect(normalizeRowHeight({})).toBe('small')
    })

    it('preserves valid row heights', () => {
      expect(normalizeRowHeight('small')).toBe('small')
      expect(normalizeRowHeight('medium')).toBe('medium')
      expect(normalizeRowHeight('large')).toBe('large')
      expect(normalizeRowHeight('extra')).toBe('extra')
    })
  })

  describe('normalizeFontScale', () => {
    it('falls back to standard for invalid or missing values', () => {
      expect(normalizeFontScale(null)).toBe('standard')
      expect(normalizeFontScale(undefined)).toBe('standard')
      expect(normalizeFontScale('huge')).toBe('standard')
      expect(normalizeFontScale(14)).toBe('standard')
    })

    it('preserves valid font scales', () => {
      expect(normalizeFontScale('standard')).toBe('standard')
      expect(normalizeFontScale('large')).toBe('large')
      expect(normalizeFontScale('xlarge')).toBe('xlarge')
    })
  })

  describe('computeGridDisplay 4x3 combinations', () => {
    const cases: Array<[RowHeight, FontScale, number, number, number, boolean]> = [
      // standard (lineHeight 20, headerHeight 36)
      ['small', 'standard', 32, 1, 36, false],
      ['medium', 'standard', 56, 2, 36, true],
      ['large', 'standard', 88, 4, 36, true],
      ['extra', 'standard', 128, 6, 36, true],
      // large (lineHeight 23, headerHeight 36)
      ['small', 'large', 32, 1, 36, false],
      ['medium', 'large', 56, 2, 36, true],
      ['large', 'large', 88, 3, 36, true],
      ['extra', 'large', 128, 5, 36, true],
      // xlarge (lineHeight 26, headerHeight 37)
      ['small', 'xlarge', 34, 1, 37, false],
      ['medium', 'xlarge', 56, 1, 37, false],
      ['large', 'xlarge', 88, 3, 37, true],
      ['extra', 'xlarge', 128, 4, 37, true],
    ]

    it.each(cases)(
      'rowHeight=%s, fontScale=%s -> rowHeightPx=%i, lineClamp=%i, headerHeightPx=%i, multiline=%s',
      (rowHeight, fontScale, expectedRowHeightPx, expectedLineClamp, expectedHeaderHeightPx, expectedMultiline) => {
        const result = computeGridDisplay(rowHeight, fontScale)
        expect(result.rowHeightPx).toBe(expectedRowHeightPx)
        expect(result.lineClamp).toBe(expectedLineClamp)
        expect(result.headerHeightPx).toBe(expectedHeaderHeightPx)
        expect(result.multiline).toBe(expectedMultiline)
        expect(result.multiline).toBe(result.lineClamp > 1)
      }
    )

    it('returns expected cssVars for medium / standard', () => {
      const result = computeGridDisplay('medium', 'standard')
      expect(result.cssVars).toEqual({
        '--row-height': '56px',
        '--grid-header-height': '36px',
        '--grid-font-size': '13px',
        '--grid-font-size-sm': '11px',
        '--grid-font-size-head': '12px',
        '--grid-line-height': '20px',
        '--grid-line-clamp': '2',
      })
    })

    it('returns correct font sizes and line heights', () => {
      const standard = computeGridDisplay('small', 'standard')
      expect(standard.fontSizePx).toBe(13)
      expect(standard.fontSizeSmPx).toBe(11)
      expect(standard.fontSizeHeadPx).toBe(12)
      expect(standard.lineHeightPx).toBe(20)

      const large = computeGridDisplay('small', 'large')
      expect(large.fontSizePx).toBe(15)
      expect(large.fontSizeSmPx).toBe(13)
      expect(large.fontSizeHeadPx).toBe(14)
      expect(large.lineHeightPx).toBe(23)

      const xlarge = computeGridDisplay('small', 'xlarge')
      expect(xlarge.fontSizePx).toBe(17)
      expect(xlarge.fontSizeSmPx).toBe(14)
      expect(xlarge.fontSizeHeadPx).toBe(15)
      expect(xlarge.lineHeightPx).toBe(26)
    })
  })
})
