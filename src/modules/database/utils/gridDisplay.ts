/**
 * Grid Display and Density Utilities
 * Pure computation for grid row height, font scale, line clamp, and CSS variables.
 */

export const ROW_HEIGHTS = ['small', 'medium', 'large', 'extra'] as const
export type RowHeight = typeof ROW_HEIGHTS[number]

export const FONT_SCALES = ['standard', 'large', 'xlarge'] as const
export type FontScale = typeof FONT_SCALES[number]

export const ROW_HEIGHT_LABELS: Record<RowHeight, string> = {
  small: '小',
  medium: '中',
  large: '大',
  extra: '特大',
}

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  standard: '標準',
  large: '大',
  xlarge: '特大',
}

const ROW_HEIGHT_BASE_PX: Record<RowHeight, number> = {
  small: 32,
  medium: 56,
  large: 88,
  extra: 128,
}

interface FontScaleMetrics {
  fontSizePx: number
  fontSizeSmPx: number
  fontSizeHeadPx: number
}

const FONT_SCALE_METRICS: Record<FontScale, FontScaleMetrics> = {
  standard: {
    fontSizePx: 13,
    fontSizeSmPx: 11,
    fontSizeHeadPx: 12,
  },
  large: {
    fontSizePx: 15,
    fontSizeSmPx: 13,
    fontSizeHeadPx: 14,
  },
  xlarge: {
    fontSizePx: 17,
    fontSizeSmPx: 14,
    fontSizeHeadPx: 15,
  },
}

export function normalizeRowHeight(v: unknown): RowHeight {
  if (typeof v === 'string' && (ROW_HEIGHTS as readonly string[]).includes(v)) {
    return v as RowHeight
  }
  return 'small'
}

export function normalizeFontScale(v: unknown): FontScale {
  if (typeof v === 'string' && (FONT_SCALES as readonly string[]).includes(v)) {
    return v as FontScale
  }
  return 'standard'
}

export interface GridDisplay {
  rowHeightPx: number
  headerHeightPx: number
  fontSizePx: number
  fontSizeSmPx: number
  fontSizeHeadPx: number
  lineHeightPx: number
  lineClamp: number
  multiline: boolean
  cssVars: Record<string, string>
}

export function computeGridDisplay(rowHeight: RowHeight, fontScale: FontScale): GridDisplay {
  const normalizedRow = normalizeRowHeight(rowHeight)
  const normalizedFont = normalizeFontScale(fontScale)

  const { fontSizePx, fontSizeSmPx, fontSizeHeadPx } = FONT_SCALE_METRICS[normalizedFont]
  const lineHeightPx = Math.round(fontSizePx * 1.5)
  const baseRowHeight = ROW_HEIGHT_BASE_PX[normalizedRow]

  const rowHeightPx = Math.max(baseRowHeight, lineHeightPx + 8)
  const lineClamp = Math.max(1, Math.floor((rowHeightPx - 8) / lineHeightPx))
  const headerHeightPx = Math.max(36, Math.round(fontSizeHeadPx * 1.5) + 14)
  const multiline = lineClamp > 1

  const cssVars: Record<string, string> = {
    '--row-height': `${rowHeightPx}px`,
    '--grid-header-height': `${headerHeightPx}px`,
    '--grid-font-size': `${fontSizePx}px`,
    '--grid-font-size-sm': `${fontSizeSmPx}px`,
    '--grid-font-size-head': `${fontSizeHeadPx}px`,
    '--grid-line-height': `${lineHeightPx}px`,
    '--grid-line-clamp': String(lineClamp),
  }

  return {
    rowHeightPx,
    headerHeightPx,
    fontSizePx,
    fontSizeSmPx,
    fontSizeHeadPx,
    lineHeightPx,
    lineClamp,
    multiline,
    cssVars,
  }
}
