import fs from 'fs'
import path from 'path'
import { SPLASH_SCREENS, splashFileName, toStartupImages } from '../splashScreens'

const root = path.join(__dirname, '..', '..', '..', '..')

describe('splashScreens', () => {
  it('lists the 12 supported iPhone and iPad portrait sizes', () => {
    expect(SPLASH_SCREENS).toHaveLength(12)
  })

  it('names files by device pixels', () => {
    expect(splashFileName({ width: 430, height: 932, dpr: 3 })).toBe('splash-1290x2796.png')
  })

  it('builds exact iOS startup media queries', () => {
    const first = toStartupImages()[0]
    expect(first.url).toBe('/brand/splash-1290x2796.png')
    expect(first.media).toBe(
      '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'
    )
  })

  it('has a generated PNG for every splash screen', () => {
    for (const s of SPLASH_SCREENS) {
      expect(fs.existsSync(path.join(root, 'public', 'brand', splashFileName(s)))).toBe(true)
    }
  })

  it('keeps the generator script list in sync with SPLASH_SCREENS', () => {
    const script = fs.readFileSync(path.join(root, 'scripts', 'generate-brand-icons.mjs'), 'utf8')
    const listed = Array.from(script.matchAll(/\[(\d+),\s*(\d+),\s*(\d)\]/g)).map(m => m.slice(1).map(Number))
    expect(listed).toEqual(SPLASH_SCREENS.map(s => [s.width, s.height, s.dpr]))
  })
})
