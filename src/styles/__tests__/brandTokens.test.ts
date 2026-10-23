import fs from 'fs'
import path from 'path'

// 全域 token 必須對齊 FYCD 品牌色（深綠 #39452B、橘 #F58220），且主色在淺色／暗色都要可讀
const readCss = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')

const block = (css: string, selectorStart: string): string => {
  const start = css.indexOf(selectorStart)
  if (start < 0) throw new Error(`找不到選擇器 ${selectorStart}`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

const tokenValue = (blockCss: string, name: string): string => {
  const match = blockCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  if (!match) throw new Error(`找不到 ${name}`)
  return match[1].trim()
}

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (hexA: string, hexB: string): number => {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const tokensCss = readCss('src/styles/tokens.css')
const tokensRoot = block(tokensCss, ':root')
const tokensDark = block(tokensCss, "[data-theme='dark'],\n.theme-dark")

const legacy = [
  '#ea580c', '#f97316', '#c2410c', '#3f6212', '#365314',
  '#4d7c0f', '#f7fee7', '#818cf8', 'rgba(234,88,12', 'rgba(63,98,18',
]

const legacyIn = (css: string): string[] => {
  const normalized = css.toLowerCase().replace(/\s+/g, '')
  return legacy.filter((color) => normalized.includes(color))
}

describe('brand tokens', () => {
  it('consolidates into tokens.css as the single source of truth (no src/app/theme.css)', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/theme.css'))).toBe(false)
    expect(readCss('src/app/layout.tsx')).not.toContain('theme.css')
  })

  it('has no legacy brand colors across style files and baserow colors.scss', () => {
    expect(legacyIn(tokensCss)).toEqual([])
  })

  it.each([
    'src/styles/layout.css',
    'src/styles/toolbar.css',
    'src/styles/grid.css',
    'src/styles/components.css',
    'src/styles/latest-comment.css',
    'src/styles/baserow/colors.scss',
  ])('%s has no legacy brand colors', (file) => {
    expect(legacyIn(readCss(file))).toEqual([])
  })

  it('uses brand values', () => {
    expect(tokenValue(tokensRoot, '--accent-primary')).toBe('#DD6410')
    expect(tokenValue(tokensRoot, '--brand-green-main')).toBe('#39452B')
    expect(tokenValue(tokensRoot, '--brand-orange-main')).toBe('#DD6410')
    expect(tokenValue(tokensDark, '--accent-primary')).toBe('#DD6410')
    expect(tokenValue(tokensDark, '--accent-gradient').toLowerCase()).not.toContain('#818cf8')
  })

  it('defines unified radii, shadows, transitions, z-index, and semantic tokens in :root', () => {
    const requiredRootTokens = [
      '--text-inverse',
      '--border-subtle',
      '--border-strong',
      '--border-focus',
      '--radius-xs',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--radius-xl',
      '--radius-modal',
      '--radius-pill',
      '--shadow-sm',
      '--shadow-md',
      '--shadow-lg',
      '--shadow-modal',
      '--shadow-popover',
      '--transition-fast',
      '--transition-normal',
      '--z-sticky',
      '--z-dropdown',
      '--z-modal',
      '--z-popover',
      '--z-toast',
    ]
    for (const token of requiredRootTokens) {
      expect(tokenValue(tokensRoot, token)).toBeTruthy()
    }
  })

  it('aligns dark theme overrides for semantic text, border, and shadow tokens', () => {
    const requiredDarkTokens = [
      '--bg-primary',
      '--bg-secondary',
      '--bg-tertiary',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--text-inverse',
      '--border-color',
      '--border-subtle',
      '--border-strong',
      '--border-focus',
      '--shadow-sm',
      '--shadow-md',
      '--shadow-lg',
      '--shadow-modal',
      '--shadow-popover',
    ]
    for (const token of requiredDarkTokens) {
      expect(tokenValue(tokensDark, token)).toBeTruthy()
    }
  })

  it('uses brand focus ring in Button.tsx instead of legacy lime ring', () => {
    const buttonTsx = readCss('src/components/ui/Button.tsx')
    expect(buttonTsx).not.toContain('ring-lime-500')
  })

  it('keeps readable contrast', () => {
    const darkBg = tokenValue(tokensDark, '--bg-primary')
    expect(contrast(tokenValue(tokensRoot, '--accent-primary'), '#FFFFFF')).toBeGreaterThanOrEqual(3)
    expect(contrast(tokenValue(tokensDark, '--accent-primary'), darkBg)).toBeGreaterThanOrEqual(3)
    expect(contrast(tokenValue(tokensDark, '--accent-secondary'), darkBg)).toBeGreaterThanOrEqual(3)
  })
})
