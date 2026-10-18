import fs from 'fs'
import path from 'path'
import manifest from '../manifest'

const publicDir = path.join(__dirname, '..', '..', '..', 'public')

describe('PWA manifest', () => {
  const m = manifest()

  it('uses brand colors for the splash background and theme', () => {
    expect(m.background_color).toBe('#F5F0E6')
    expect(m.theme_color).toBe('#39452B')
  })

  it('ships separate any and maskable brand icons', () => {
    expect(m.icons).toEqual([
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ])
  })

  it('references icon files that exist', () => {
    for (const icon of m.icons ?? []) {
      expect(fs.existsSync(path.join(publicDir, icon.src))).toBe(true)
    }
  })
})
